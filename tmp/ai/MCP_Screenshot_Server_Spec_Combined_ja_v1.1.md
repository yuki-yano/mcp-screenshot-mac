# MCP サーバー統合仕様（Node/TypeScript + CLI 初期化）
**版**: v1.1  
**最終更新日**: 2025-10-30  
**対象**: Coding Agent / 実装エンジニア

> 本仕様は「macOS アプリのウィンドウをスクリーンショット → 一時ファイル保存 → パス/URI を返す MCP サーバー」の**要件・設計・仕様**に、
> Node/Bun で動作する **TypeScript ESM CLI リポジトリ初期化仕様**（ユーザー提供ドキュメント）を**取り込んで再構成**したものです。ベースラインの CLI 初期化要件は付録 A に要約・反映しています（原本: *NODE_CLI_INIT_PROMPT.md*）。

---

## 0. TL;DR

- **目的**: 指定した **macOS アプリのウィンドウ**をキャプチャし、一時ファイルへ保存して **絶対パス + `file://` URI + MCP リソース**を返す **MCP サーバー**を提供。  
- **技術**: Node.js (TypeScript, ESM) + MCP TypeScript SDK。ウィンドウ矩形は **JXA**（`osascript -l JavaScript`）で取得、撮影は **`screencapture`** を使用。  
- **配布**: npm 公開 → **`npx mcp-screenshot-mac`** で起動（stdio）。Bun 互換（`bun x`）。  
- **統合**: リポジトリの構成/スクリプト/バンドルは **tsdown による CLI 初期化仕様**に準拠（ESM、shebang 付与、Flat ESLint、Vitest など）。付録 A 参照。  
- **出力**: JSON（`path`,`uri`,`appName`,`rect`,`scale`,`format`） + MCP `resource` を返却。

---

## 1. スコープ & ゴール

### 1.1 ゴール
- コーディングエージェントが **ツール呼び出し 1 回**でスクショの **パス/URI** を取得し、画像を即時に読み込める。  
- リポジトリは **Node/Bun で動作し、tsdown でビルド**でき、**npx** 実行（shebang）に対応。

### 1.2 非ゴール
- 動画キャプチャ、画像編集、Windows/Linux 対応、任意矩形の GUI 指定。

---

## 2. ユースケース
- `bundleId`（`com.apple.Safari` 等）で対象アプリを特定し、最前面の `windowIndex=0` を **PNG** でキャプチャ。  
- マルチディスプレイで `-R`（矩形）失敗時、**ウィンドウID** モードをフォールバック。  
- 返却された **`file://` URI** をクライアント（例: Claude Desktop + Filesystem Server）から読ませて解析。

---

## 3. システム要件

- **OS**: macOS 12+  
- **権限**: 画面収録（Screen Recording）必須、必要に応じてアクセシビリティ  
- **ランタイム**: Node.js >= 24.0 / Bun >= 1.0  
- **ツール**: `osascript`（JXA）, `screencapture`（標準付属）
  - `GetWindowID` は **任意依存**。インストールされていれば利用し、存在しない場合は矩形モードのみで完結する。
  - 配布物には同梱しない。README で Homebrew 等による導入手順と未導入時の挙動（矩形フォールバック）を明記する。

---

## 4. MCP コントラクト

### 4.1 サーバー
- **サーバー名**: `mcp-screenshot-mac`  
- **起動**: `npx mcp-screenshot-mac`（または `bun x mcp-screenshot-mac`）  
- **トランスポート**: stdio（既定。HTTP への差替え可）

### 4.2 ツール API

**name**: `screenshot_app_window`  
**description**: 指定アプリの前面ウィンドウ（index 指定可）をスクリーンショットし、一時ファイルに保存して **パス/URI** を返す。

**入力スキーマ（JSON Schema）**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "anyOf": [
    { "required": ["bundleId"] },
    { "required": ["appName"] }
  ],
  "properties": {
    "bundleId": { "type": "string", "description": "例: com.apple.Safari" },
    "appName": { "type": "string", "description": "例: Safari（bundleId が不明な場合）" },
    "windowIndex": { "type": "integer", "minimum": 0, "default": 0 },
    "format": { "type": "string", "enum": ["png", "jpg"], "default": "png" },
    "includeShadow": { "type": "boolean", "default": false, "description": "true でウィンドウ影を含める（既定 false）" },
    "timeoutMs": { "type": "integer", "minimum": 1000, "default": 30000 },
    "preferWindowId": { "type": "boolean", "default": false, "description": "可能なら -l <windowid> を使用" }
  }
}
```

**出力スキーマ（JSON Schema）**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["path", "uri", "appName", "rect", "scale", "format"],
  "properties": {
    "path": { "type": "string", "description": "絶対パス（/var/folders/...）" },
    "uri": { "type": "string", "description": "file:// スキームの URI" },
    "appName": { "type": "string" },
    "rect": {
      "type": "object",
      "required": ["x", "y", "w", "h"],
      "properties": {
        "x": { "type": "integer" },
        "y": { "type": "integer" },
        "w": { "type": "integer" },
        "h": { "type": "integer" }
      }
    },
    "scale": { "type": "number", "description": "Retina スケール（例: 2）" },
    "format": { "type": "string", "enum": ["png", "jpg"] }
  }
}
```

**MCP メッセージ content**  
- `content[0]`: `type: "text"` — 上記出力 JSON を文字列化して格納（機械可読）  
- `content[1]`: `type: "resource"` — 画像ファイルを指すリソース（`uri`, `mimeType`, `name`, `description`）

**エラー**  
- `ProcessNotFound` / `NoWindow` / `PermissionDenied` / `CaptureFailed` / `Timeout`  
- 返し方: `isError: true` と `content: [{"type":"text","text":"<原因と対処>"}]`

---

## 5. 詳細設計

### 5.1 方式
- **矩形キャプチャ（既定）**: JXA で `System Events` → `position`/`size` を取得し、5.2 のスケール判定でピクセル換算したのち `screencapture -R x,y,w,h` を実行。  
- **ウィンドウID**: `GetWindowID` が利用可能なら `screencapture -l <windowid>` を試行。失敗時は矩形へフォールバック。

### 5.2 座標/スケール
- JXA はポイント座標 → ピクセルへ変換（四捨五入）。  
- 取得した矩形に対し、`NSScreen.screens` を走査して「ウィンドウ中心が属するディスプレイ」を決定し、その `backingScaleFactor` を採用する。該当スクリーンが見つからない場合のみ `mainScreen` をフォールバックとする。  
- サブディスプレイが負座標になる構成では `-R` が失敗し得るため **ウィンドウID優先**設定を用意（`preferWindowId: true`）。

### 5.3 一時ファイル
- `os.tmpdir()` 配下に `mcp-screenshot-<rand>/shot-<uuid>.<ext>` を作成。  
- 返却を完了した後、既定で **600 秒（10 分）後にディレクトリごと削除**するタイマーを設定し、TTL 内であればクライアントがファイルへアクセスできるようにする。  
- TTL は環境変数 `MCP_SCREENSHOT_MAC_TTL_MS` で調整可能（`0` の場合は削除しない）。

### 5.4 タイムアウト/ログ
- `timeoutMs`（既定 30s）を JXA / screencapture 双方に適用。  
- 失敗時は `stderr` に詳細、返却メッセージに簡潔な原因と対処。

---

## 6. リポジトリ初期化（CLI 準拠事項）

> **本サーバーのリポジトリは、ユーザー提供の「Node/Bun 対応 TypeScript ESM CLI リポジトリ初期化仕様」に準拠**します（ESM、tsdown、Flat ESLint、Vitest、Prettier、pnpm）。当該仕様の骨子は**付録 A**に取り込み済みです。エージェントは付録 A に従って**最小 CLI**を生成し、下記の差分を適用してください。  ← 出典: ユーザー提供ドキュメント。

### 6.1 差分（このプロジェクト固有）
- **パッケージ名/バイナリ**: `mcp-screenshot-mac` / 同名の bin を提供  
- **依存**:  
  - 追加: `@modelcontextprotocol/sdk`, `execa`, `zod@^3`  
  - 開発: `typescript`, `tsdown`, `vitest`, `eslint` 系, `prettier`, `@types/node`  
- **エントリ**: tsdown の `entry` を `index`（サーバー本体）と `cli`（起動スクリプト）の 2 本立てに。  
- **shebang**: `banner: { js: '#!/usr/bin/env node' }` を必ず付与（npx 実行用）。`tsdown` の仕様上、`dist/index.js` にも shebang が入るが Node/Bun の ESM ローダーは先頭 shebang を読み飛ばすため問題なしとする旨を README に明記する。  
- **コード規約**: **class/interface を使用しない**（関数 + `type` alias）。

### 6.2 代表的なファイル構成
```
mcp-screenshot-mac/
  ├─ src/
  │   ├─ index.ts        # MCP サーバー本体（registerTool, connect）
  │   ├─ cli.ts          # エントリ（引数パース最小・サーバー起動）
  │   └─ jxa/
  │       └─ window-rect.jxa.js  # 文字列化して osascript 実行するソース
  ├─ test/
  │   └─ smoke.test.ts
  ├─ dist/                # tsdown 出力
  ├─ package.json
  ├─ tsconfig.json
  ├─ tsdown.config.ts
  ├─ eslint.config.mjs
  ├─ prettier.config.mjs
  ├─ vitest.config.ts
  ├─ .gitignore
  ├─ README.md
  └─ LICENSE
```

> 既存テンプレートでは `src/lib/args.ts` を併置するケースがあるが、本プロジェクトは CLI が MCP サーバー起動のみを担うため **同ファイルは生成しない**。将来的に CLI から追加サブコマンドを提供する場合にのみ導入を検討する。

### 6.3 `package.json`（サーバー向けテンプレート）
```json
{
  "name": "mcp-screenshot-mac",
  "version": "0.1.0",
  "description": "MCP server to screenshot a macOS app window and return a local file path/URI",
  "type": "module",
  "license": "MIT",
  "author": "Your Name",
  "bin": {
    "mcp-screenshot-mac": "./dist/cli.js"
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    }
  },
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "package.json"],
  "publishConfig": { "access": "public" },
  "engines": {
    "node": ">=24.0.0",
    "bun": ">=1.0.0",
    "pnpm": ">=9.0.0"
  },
  "packageManager": "pnpm@9",
  "scripts": {
    "dev": "tsdown --watch",
    "build": "tsdown",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest --watch",
    "ci": "pnpm run format && pnpm run typecheck && pnpm run lint && pnpm run test"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest",
    "execa": "latest",
    "zod": "v3"
  },
  "devDependencies": {
    "@types/node": "latest",
    "eslint": "latest",
    "@typescript-eslint/eslint-plugin": "latest",
    "@typescript-eslint/parser": "latest",
    "eslint-config-prettier": "latest",
    "prettier": "latest",
    "tsdown": "latest",
    "typescript": "latest",
    "vitest": "latest"
  }
}
```

### 6.4 `tsdown.config.ts`
```ts
import { defineConfig } from 'tsdown'

export default defineConfig({
  name: 'mcp-screenshot-mac',
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
  },
  outDir: 'dist',
  format: ['esm'],
  platform: 'node',
  dts: true,
  sourcemap: true,
  minify: false,
  clean: true,
  banner: { js: '#!/usr/bin/env node' }, // ← npx 実行に必須
  external: [],
  report: true,
})
```

---

## 7. 実装要点（擬似コード）

### 7.1 `src/index.ts`（MCP サーバー本体）
```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { execa } from 'execa'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import crypto from 'node:crypto'

const InputSchema = z.object({
  bundleId: z.string().optional(),
  appName: z.string().optional(),
  windowIndex: z.number().int().nonnegative().default(0).optional(),
  format: z.enum(['png','jpg']).default('png').optional(),
  includeShadow: z.boolean().default(false).optional(),
  timeoutMs: z.number().int().positive().default(30000).optional(),
  preferWindowId: z.boolean().default(false).optional(),
}).refine(v => v.bundleId || v.appName, { message: 'bundleId か appName のどちらかは必須です' })

const server = new McpServer({ name: 'mcp-screenshot-mac', version: '0.1.0' })

server.registerTool(
  'screenshot_app_window',
  { title: 'Screenshot macOS app window', description: '指定アプリの前面ウィンドウをスクリーンショットしてパスとURIを返す', inputSchema: InputSchema },
  async (raw) => {
    const input = InputSchema.parse(raw)
    const jxaPayload = JSON.stringify({
      bundleId: input.bundleId ?? null,
      appName: input.appName ?? null,
      windowIndex: input.windowIndex ?? 0,
    })

    const jxaSource = `
      function run(argv) {
        ObjC.import('AppKit');
        const arg = JSON.parse(argv[0]);
        const targetApp = arg.bundleId ? Application(arg.bundleId) : Application(arg.appName);
        const appName = targetApp.name();
        targetApp.activate();
        delay(0.25);
        const systemEvents = Application('System Events');
        const proc = systemEvents.processes.byName(appName);
        if (!proc.exists()) { return JSON.stringify({ error: 'ProcessNotFound', appName }); }
        if (proc.windows.length === 0) { return JSON.stringify({ error: 'NoWindow', appName }); }
        const idx = Math.min(arg.windowIndex || 0, proc.windows.length - 1);
        const win = proc.windows[idx];
        const pos = win.position();
        const size = win.size();

        const rawRect = { x: pos[0], y: pos[1], w: size[0], h: size[1] };
        const center = { x: rawRect.x + rawRect.w / 2, y: rawRect.y + rawRect.h / 2 };

        var scale = 1;
        if ($.NSScreen.screens) {
          const screens = ObjC.unwrap($.NSScreen.screens);
          for (const screen of screens) {
            const frame = screen.frame;
            const minX = frame.origin.x;
            const maxX = minX + frame.size.width;
            const minY = frame.origin.y;
            const maxY = minY + frame.size.height;
            if (center.x >= minX && center.x <= maxX && center.y >= minY && center.y <= maxY) {
              scale = screen.backingScaleFactor;
              break;
            }
          }
        }

        const rect = {
          x: Math.round(rawRect.x * scale),
          y: Math.round(rawRect.y * scale),
          w: Math.round(rawRect.w * scale),
          h: Math.round(rawRect.h * scale),
        };

        return JSON.stringify({ appName, rect, scale: Number(scale) });
      }
    `

    const jxa = await execa('osascript', ['-l', 'JavaScript', '-e', jxaSource, jxaPayload], { timeout: input.timeoutMs })
    const jxaOut = JSON.parse(jxa.stdout) as any
    if (jxaOut?.error) {
      return { content: [{ type: 'text', text: `JXA error: ${jxaOut.error} (${jxaOut.appName ?? ''})` }], isError: true }
    }

    const id = crypto.randomUUID()
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-screenshot-'))
    const filename = `shot-${id}.${input.format}`
    const filepath = path.join(tmpDir, filename)

    const rect = jxaOut.rect
    const baseArgs = ['-x', '-t', input.format]
    if (!input.includeShadow) baseArgs.push('-o')

    let captureArgs = [...baseArgs, '-R', `${rect.x},${rect.y},${rect.w},${rect.h}`]

    if (input.preferWindowId) {
      try {
        const name = input.appName ?? jxaOut.appName
        const escapedName = JSON.stringify(name)
        const script = [
          'command -v GetWindowID >/dev/null 2>&1',
          `GetWindowID ${escapedName} --list | awk -F 'id=' "/size=[1-9]/{print \\\$3; exit 0}"`,
        ].join(' && ')
        const idOut = await execa('bash', ['-lc', script])
        const windowId = idOut.stdout.trim()
        if (windowId) {
          captureArgs = [...baseArgs, '-l', windowId]
        }
      } catch {}
    }

    try {
      await execa('screencapture', [...captureArgs, filepath], { timeout: input.timeoutMs })
    } catch (e) {
      const msg = (e as any)?.stderr ?? (e as Error)?.message ?? String(e)
      return { content: [{ type: 'text', text: 'screencapture failed: ' + msg }], isError: true }
    }

    const uri = `file://${filepath}`
    const result = { path: filepath, uri, appName: jxaOut.appName, rect, scale: jxaOut.scale, format: input.format }
    const ttlMs = Number(process.env.MCP_SCREENSHOT_MAC_TTL_MS ?? '600000')
    if (Number.isFinite(ttlMs) && ttlMs > 0) {
      setTimeout(() => {
        void fs.rm(tmpDir, { recursive: true, force: true })
      }, ttlMs).unref?.()
    }
    return {
      content: [
        { type: 'text', text: JSON.stringify(result, null, 2) },
        { type: 'resource', uri, name: filename, mimeType: input.format === 'png' ? 'image/png' : 'image/jpeg', description: `Screenshot of ${jxaOut.appName}` },
      ],
      structuredContent: result,
    }
  }
)

await server.connect(new StdioServerTransport())
```

### 7.2 `src/cli.ts`（最小エントリ）
```ts
import './index.js' // 起動時にサーバーが connect されるだけ
```

---

## 8. クライアント統合例

### 8.1 Claude Desktop
`~/Library/Application Support/Claude/claude_desktop_config.json` に追加:
```json
{
  "mcpServers": {
    "screenshot-mac": {
      "command": "npx",
      "args": ["-y", "mcp-screenshot-mac"]
    }
  }
}
```
※ 画像をクライアントから開くには Filesystem Server を併用するのが簡便です。

### 8.2 ツール呼び出し例（エージェント→MCP）
```jsonc
{
  "tool_name": "screenshot_app_window",
  "arguments": {
    "bundleId": "com.apple.Safari",
    "windowIndex": 0,
    "format": "png",
    "includeShadow": false
  }
}
```

### 8.3 期待レスポンス（成功）
```json
{
  "path": "/var/folders/.../mcp-screenshot-abc123/shot-<uuid>.png",
  "uri": "file:///var/folders/.../mcp-screenshot-abc123/shot-<uuid>.png",
  "appName": "Safari",
  "rect": { "x": 120, "y": 80, "w": 1440, "h": 900 },
  "scale": 2,
  "format": "png"
}
```

---

## 9. テスト計画
- 正常系: Safari/Notes などで撮影、`includeShadow`/`format` の組合せ。  
- 準正常: `appName` のみ / `bundleId` のみ / 存在しないアプリ。  
- 異常系: 画面収録未許可、負座標ディスプレイ、`timeoutMs` 短縮。  
- ファイル検証: 返却 `path` が存在、拡張子/mime 一致、サイズ > 0。

---

## 10. トラブルシュート
- **初回失敗**: 画面収録/アクセシビリティ権限を実行元に付与。  
- **負座標**: `preferWindowId: true` で ID モードへ。  
- **フルスクリーン**: 通常ウィンドウに戻すか ID モード。

---

## 11. Definition of Done
- ツール `screenshot_app_window` が要件を満たし、テスト通過。  
- `npx`/`bun x` で起動、クライアントから画像リソースを取得可能。

---

## 付録 A: CLI リポジトリ初期化要件（取り込み）
本プロジェクトは、**Node/Bun 対応 TypeScript ESM CLI** の初期化仕様に準拠します。要点:
- ESM 前提（`"type": "module"`）、**tsdown** ビルド、**shebang** 付与で `npx`/`bun x` 実行対応。  
- パッケージマネージャは **pnpm**、テストは **Vitest**、整形は **Prettier**、Lint は **Flat ESLint**。  
- プロジェクト雛形: `src/index.ts`（ライブラリ）/ `src/cli.ts`（バイナリ）/ `src/lib/args.ts`（最小パーサ）。  
- `package.json` の `exports`/`types` を明示。`engines` は Node >= 24, Bun >= 1。  
- **class/interface 禁止**（関数 + `type`）。  
- 具体テンプレは原本 *NODE_CLI_INIT_PROMPT.md* を参照（本仕様はそこからの要件を取り込んでいます）。

---

## 参考リンク
- ユーザー提供: **Node/Bun TypeScript ESM CLI リポジトリ初期化仕様**（*NODE_CLI_INIT_PROMPT.md*）

