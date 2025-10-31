# Requirements Document

## Introduction
Node.js 24+ と Bun 1+ をサポートする TypeScript ESM CLI プロジェクトを mcp-screenshot-mac という名前で初期化し、pnpm ベースの開発環境に必要なビルダー・リンター・フォーマッタ・テスト基盤を整える。ここでは MCP の機能実装は扱わず、将来の開発が即座に始められるように開発ツールの導入と設定だけを完了する。

## Requirements

### Requirement 1: プロジェクト初期化とメタデータ設定
**Objective:** As a project maintainer, I want プロジェクト雛形に正しいパッケージメタデータとエンジン要件を備えたい, so that Node.js 24+/Bun 1+ 環境で確実に導入できる。

#### Acceptance Criteria
1. WHEN 開発者が `pnpm install` を実行するとき
   THEN プロジェクトは依存解決に成功し、`package.json` の `packageManager` が `pnpm@9` に設定されている。
2. IF 利用者の Node.js バージョンが 24.0.0 未満であるとき
   THEN `pnpm install` はエンジン要件を理由に警告またはエラーを出力するよう `engines.node >= 24.0.0` が宣言されている。
3. WHERE プロジェクトが公開 npm パッケージとして扱われる前提において
   THE `package.json` は `name`, `version`, `description`, `license`, `type: "module"` を含み、bin エントリを `dist/cli.js` に設定している。

### Requirement 2: TypeScript とビルドパイプラインの整備
**Objective:** As a build engineer, I want tsdown を使ったビルドパイプラインを構築したい, so that TypeScript ソースを ESM 形式で配布できる。

#### Acceptance Criteria
1. WHEN `pnpm run build` を実行するとき
   THEN tsdown は `src/index.ts` と `src/cli.ts` をビルドし `dist/` 配下に ESM と型定義を生成する。
2. WHEN tsdown の設定を確認するとき
   THEN `tsdown.config.ts` は `entry`, `outDir`, `format: ["esm"]`, `banner: { js: '#!/usr/bin/env node' }` を含み、clean と sourcemap が有効化されている。
3. WHERE TypeScript 設定が存在する文脈において
   THE `tsconfig.json` は `moduleResolution: "bundler"`, `target: "ES2022"` など ESM CLI に適したオプションを定義し、`include` に `src/**/*.ts` を含む。

### Requirement 3: コード品質ツールの導入
**Objective:** As a team lead, I want ESLint と Prettier による整形と静的解析を統合したい, so that スタイルと品質を一貫して保てる。

#### Acceptance Criteria
1. WHEN 開発者が `pnpm run lint` を実行するとき
   THEN Flat ESLint がプロジェクト全体を解析し、TypeScript ファイルに対してエラーや警告を報告できる。
2. WHEN プロジェクトのルートに ESLint 設定ファイルを確認するとき
   THEN `eslint.config.mjs` は Flat Config 形式で `@typescript-eslint` プラグインと Prettier の競合解消設定を読み込む。
3. WHEN 開発者が `pnpm run format` を実行するとき
   THEN Prettier がコードと設定ファイルを整形し、`format:check` スクリプトが差分検出のために利用できる。

### Requirement 4: テストと開発支援スクリプト
**Objective:** As a QA engineer, I want Vitest ベースのテスト実行環境を準備したい, so that 将来の機能実装に対して即座にテストを書ける。

#### Acceptance Criteria
1. WHEN 開発者が `pnpm run test` を実行するとき
   THEN Vitest が正常終了し、サンプルテストが少なくとも 1 件存在してパスする。
2. WHERE テスト設定ファイルを参照する状況において
   THE `vitest.config.ts` は ESM 形式でエクスポートされ、`test` ディレクトリを対象にする設定を含む。
3. WHEN プロジェクトの npm scripts を確認するとき
   THEN `dev`, `build`, `format`, `format:check`, `lint`, `test`, `test:watch`, `ci` など開発支援スクリプトが定義されている。
