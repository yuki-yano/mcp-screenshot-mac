# Requirements Document

## Introduction
`mcp-screenshot-mac` は macOS 専用の MCP サーバーとして、指定アプリの前面ウィンドウをスクリーンショットしてエージェントに返却する機能を提供する。本機能では Node.js 24 以降で動作する TypeScript ESM サーバーを構築し、JXA と screencapture を組み合わせた撮影処理、一時ファイルの TTL 管理、MCP プロトコルに沿ったレスポンス出力、pnpm + tsdown を用いた配布構成を整備することを目的とする。

## Requirements

### Requirement 1: MCP サーバー起動とツール定義
**Objective:** As a coding agent, I want `mcp-screenshot-mac` MCP サーバーを起動して `screenshot_app_window` ツールを利用したい, so that 単一の MCP 呼び出しでスクリーンショット取得ができる。

#### Acceptance Criteria
1. WHEN 利用者が `npx mcp-screenshot-mac` または `bun x mcp-screenshot-mac` を実行するとき
   THEN MCP サーバーは stdio トランスポートで起動し、`screenshot_app_window` ツールを登録して待機する。
2. IF ツール呼び出しの入力が `bundleId` と `appName` の両方を欠いているとき
   THEN サーバーはバリデーションエラーを返し、どちらかが必須である旨を明示する。
3. WHERE `format`, `includeShadow`, `windowIndex`, `timeoutMs`, `preferWindowId` が引数として渡された文脈において
   THE サーバーは JSON Schema に基づき既定値を適用しつつ型チェック済みの構造体へ変換する。
4. WHEN サーバーが起動メッセージを構築するとき
   THEN サーバーは ツールのタイトル・説明・入力スキーマを MCP のメタデータとして含める。

### Requirement 2: スクリーンショット取得フロー
**Objective:** As a macOS user, I want 前面ウィンドウを正しく撮影したい, so that 取得画像を解析や共有に利用できる。

#### Acceptance Criteria
1. WHEN ツールが呼び出され bundleId もしくは appName が解決できるとき
   THEN サーバーは JXA (osascript -l JavaScript) を用いて対象ウィンドウの座標・サイズ・アプリ名・スケールを取得する。
2. WHEN 取得した矩形の中心に対応するディスプレイを決定できるとき
   THEN サーバーは該当ディスプレイの `backingScaleFactor` を適用し、ポイントからピクセルへ変換した矩形を算出する。
3. WHEN `preferWindowId` が真であり GetWindowID が利用可能なとき
   THEN サーバーは `screencapture -l <windowId>` を優先的に試行し、失敗時は矩形モードへフォールバックする。
4. WHEN screencapture コマンドが成功したとき
   THEN サーバーは指定フォーマット（png/jpg）でファイルを書き出し、`includeShadow` が偽のときは `-o` オプションで影を除去する。

### Requirement 3: レスポンスと MCP リソース出力
**Objective:** As a client integrator, I want スクリーンショット情報とファイルリソースを受け取りたい, so that エージェントから画像を直接プレビューできる。

#### Acceptance Criteria
1. WHEN 撮影が完了したとき
   THEN サーバーは `path`, `uri`, `appName`, `rect`, `scale`, `format` を含む JSON を生成する。
2. WHERE MCP レスポンスを構築する文脈において
   THE サーバーは `content[0]` に上記 JSON の文字列化、`content[1]` に `type: "resource"` で `file://` URI を指す項目を含める。
3. WHEN `rect` 情報を返却するとき
   THEN サーバーは integer 値の `x`, `y`, `w`, `h` を提供し、取得した `scale` を number として付与する。
4. WHEN クライアントがレスポンスを受信したとき
   THEN `structuredContent` フィールドは JSON と同等の構造体を保持し、二重管理を避ける。

### Requirement 4: 一時ファイル管理と TTL
**Objective:** As an operations engineer, I want 一時ファイルのライフサイクルを制御したい, so that ディスクリークを抑えつつクライアントが画像にアクセスできる。

#### Acceptance Criteria
1. WHEN スクリーンショットファイルを生成するとき
   THEN サーバーは `os.tmpdir()` 配下に `mcp-screenshot-<UUID>` ディレクトリを作成して保存する。
2. WHEN レスポンスを返却した直後
   THEN サーバーは 600 秒後にディレクトリを削除する非同期処理をスケジュールし、TTL 経過後にクリーンアップする。
3. IF 環境変数 `MCP_SCREENSHOT_MAC_TTL_MS` が設定されているとき
   THEN サーバーは TTL を該当値に上書きし、`0` の場合は自動削除を無効化する。
4. WHEN 削除処理が失敗したとき
   THEN サーバーは致命的エラーではなく警告ログを記録し、次回以降に影響が出ないようにする。

### Requirement 5: エラー処理とタイムアウト
**Objective:** As a support engineer, I want 失敗時に原因が分かるレスポンスを受け取りたい, so that 利用者に対処方法を案内できる。

#### Acceptance Criteria
1. WHEN JXA が対象プロセスを見つけられないとき
   THEN サーバーは `ProcessNotFound` を明示した `isError: true` レスポンスを返し、アプリ名をメッセージに含める。
2. WHEN 対象アプリに可視ウィンドウが存在しないとき
   THEN サーバーは `NoWindow` エラーを返し、ウィンドウ表示を促す指示を含める。
3. WHEN screencapture が失敗またはタイムアウトしたとき
   THEN サーバーは `CaptureFailed` または `Timeout` として標準エラー出力の要約をメッセージ化する。
4. WHILE ツールが処理を行う間
   THE サーバーは `timeoutMs` の値を JXA 実行と screencapture のいずれにも適用し、経過時にはタイムアウト処理を実行する。
