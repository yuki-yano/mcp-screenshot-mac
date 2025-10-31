# Design Document

## Overview
`mcp-screenshot-mac` は macOS アプリの前面ウィンドウをスクリーンショットし、MCP プロトコル経由で画像へのパスとリソースを返すサーバーである。本設計では Node.js 24+ と TypeScript ESM を前提に、JXA を用いたウィンドウ情報取得、`screencapture` コマンドによる撮影、TTL 付き一時ファイル管理、MCP レスポンス生成を統合する。対象ユーザーはエージェント開発者やツール利用者であり、1 回のツール呼び出しで安定した画像取得ができることを目的とする。

### Goals
- `screenshot_app_window` ツールを通じて macOS アプリのウィンドウを撮影し、パス・URI・矩形・スケールなどのメタ情報を返却する。
- JXA と screencapture を組み合わせた撮影ロジックを実装し、複数ディスプレイやウィンドウ ID のフォールバックに対応する。
- 一時ファイルの TTL 管理と MCP リソース返却を行い、エージェントが画像を即座に扱えるようにする。

### Non-Goals
- macOS 以外の OS をサポートしない。
- 動画キャプチャや画像編集などスクリーンショット以外の機能は提供しない。
- MCP 以外の通信プロトコル（HTTP サーバー等）は提供しない。

## Architecture

### High-Level Architecture
サーバーは `@modelcontextprotocol/sdk` の `McpServer` を利用し、起動時に `screenshot_app_window` ツールを登録する。ツールの実装は以下のフローで構成される:
1. 入力バリデーション: zod スキーマで `bundleId`/`appName` の必須条件と各パラメータの型を検証。
2. ウィンドウ情報取得: JXA スクリプトを `osascript -l JavaScript` 経由で実行し、ウィンドウ座標・サイズ・アプリ名・スケールを取得。
3. 撮影パイプライン: `screencapture` を呼び出し、矩形モードまたは `-l <windowId>` モードで画像取得。
4. 一時ファイル生成と TTL: `os.tmpdir()` 配下にディレクトリを作成し、画像保存後に遅延削除をスケジュール。
5. レスポンス生成: パスと MCP リソースを含む JSON を `content` および `structuredContent` として返却。

```mermaid
graph TD
  A[Agent client] -->|MCP request| B[screenshot_app_window tool]
  B --> C[Input validation (zod)]
  C --> D[JXA executor]
  D -->|rect,appName,scale| E[Screencapture runner]
  E --> F[Temp file manager]
  F --> G[Response builder]
  G -->|MCP response| A
```

### Technology Stack and Design Decisions
- Node.js 24+ / Bun 1+ の ESM 実行環境
- TypeScript + tsdown によるバンドル、pnpm で依存管理
- 主要依存: `@modelcontextprotocol/sdk`, `execa`, `zod`

#### Key Decisions
- **Decision**: JXA + screencapture による撮影フローを採用する。
  - **Context**: macOS 標準 API で前面ウィンドウの矩形と画像を取得する必要がある。
  - **Alternatives**: AppleScript 直接制御、Swift/Objective-C バイナリ、CGWindow API 呼び出し。
  - **Selected Approach**: `osascript -l JavaScript` で JXA を実行し、`execa` で `screencapture` をコール。
  - **Rationale**: 追加バイナリ不要で macOS 標準機能のみで完結する。
  - **Trade-offs**: JXA の実行速度とエラーメッセージが限定的である。
- **Decision**: TTL 600 秒の一時ディレクトリを採用する。
  - **Context**: エージェントが画像を読み込む時間とディスク使用のバランスが必要。
  - **Alternatives**: 即時削除、永続保存、外部ストレージ。
  - **Selected Approach**: `setTimeout` で削除タスクを予約し、環境変数で調整可能とする。
  - **Rationale**: 十分なアクセス猶予を与えつつディスクリークを防ぐ。
- **Decision**: GetWindowID の有無で撮影モードを切り替える。
  - **Context**: 負座標ディスプレイやフルスクリーン状態で `-R` が失敗するケースが存在。
  - **Alternatives**: 常に矩形モード、外部ライブラリ導入。
  - **Selected Approach**: `command -v GetWindowID` を確認し、利用可能なら `-l` を試行。
  - **Rationale**: 依存を強制せず、利用者環境で改善できる余地を残す。

## Components and Interfaces

### ツール登録層
#### MCP Server Entrypoint (`src/index.ts`)
- **Responsibility**: MCP サーバーの初期化、ツール登録、起動。
- **Dependencies**: `@modelcontextprotocol/sdk`, `zod`, `execa`, Node.js 標準モジュール。
- **Contract**: `registerTool('screenshot_app_window', schema, handler)`
  - バリデーション: `z.object({ bundleId?: string, appName?: string, ... }).refine(...)`
  - 出力: `structuredContent` + `content` (text/resource)

### 撮影ロジック層
#### ScreenshotService (`src/lib/screenshot.ts` など)
- **Responsibility**: JXA 実行、screencapture 呼び出し、結果構築。
- **Inbound**: MCP ツールハンドラー。
- **Outbound**: `execa` (osascript, screencapture), fs/os/path。
- **Contract** (擬似コード)
  ```typescript
  type ScreenshotInput = {
    appName?: string
    bundleId?: string
    windowIndex: number
    format: 'png' | 'jpg'
    includeShadow: boolean
    timeoutMs: number
    preferWindowId: boolean
  }
  type ScreenshotResult = {
    path: string
    uri: string
    appName: string
    rect: { x: number; y: number; w: number; h: number }
    scale: number
    format: 'png' | 'jpg'
  }
  async function capture(input: ScreenshotInput): Promise<ScreenshotResult>
  ```
- **Preconditions**: いずれかのアプリ識別子が指定されている。
- **Postconditions**: ファイルが存在し、JSON で返却できる。

#### JXA Script (`src/jxa/window-rect.jxa.js`)
- **Responsibility**: ウィンドウ座標・サイズ・スケール取得。
- **Contract**: `run([JSON.stringify({ bundleId, appName, windowIndex })])` → JSON 文字列。

### 一時ファイル管理層
#### TempFileManager
- **Responsibility**: `fs.mkdtemp` でディレクトリ作成、削除タイマー設定。
- **Contract**:
  ```typescript
  function createTempFile(ext: 'png' | 'jpg'): Promise<{ dir: string; path: string; scheduleCleanup(ttlMs: number): void }>
  ```

## Error Handling
- バリデーション失敗: MCP エラーレスポンスに `isError: true` とメッセージ。
- JXA エラー: `ProcessNotFound`/`NoWindow` を判別し、説明文を含める。
- screencapture エラー: `stderr` を要約し、`CaptureFailed` で返却。
- タイムアウト: `timeoutMs` を超過した場合 `Timeout` エラーを返し、両方の外部プロセスにタイムアウトを適用。
- 削除失敗: `fs.rm` の結果はログ警告に留め、レスポンスは成功のまま。

## Testing Strategy
- **Unit Tests**: 
  - 入力バリデーション (zod スキーマ) が bundleId/appName 必須条件を enforce。
  - TempFileManager の TTL スケジューリング（タイマーをモック）。
- **Integration Tests** (mock exec):
  - JXA 結果をモックして矩形→screencapture 呼び出しのフローを検証。
  - `preferWindowId` true のとき GetWindowID 未インストールで矩形にフォールバック。
- **Manual Tests**:
  - 実機 macOS で `pnpm run build && dist/cli.js` を起動し、Safari などを撮影。影あり/なし、png/jpg 切り替えを確認。

## Security Considerations
- 実行ユーザーには画面収録権限が必要。README で権限付与手順を案内。
- 出力されたファイルのパスには個人名などが含まれる可能性があるため、ログ出力を最小限にする。

## Migration Strategy
初回実装のため適用なし。
