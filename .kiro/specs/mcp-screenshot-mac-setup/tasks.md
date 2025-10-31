# Implementation Plan

- [ ]  1. プロジェクトメタデータと依存管理の初期化
  - `package.json` を生成して名前・バージョン・説明・ライセンス・`type: "module"`・`bin` エントリなどの基本メタデータを登録する。
  - `engines` に Node >= 24.0.0、Bun >= 1.0.0、pnpm >= 9.0.0 を宣言し、`packageManager` に `pnpm@9` を設定する。
  - pnpm を使って tsdown, typescript, vitest, eslint, prettier, @typescript-eslint 系, eslint-config-prettier, @types/node など設計で指定した依存を導入する。
  - _Requirements: 1.1, 1.2, 1.3_

- [ ]  2. TypeScript ビルドパイプラインの整備
- [ ]  2.1 tsconfig と tsdown 設定を構築する
  - `tsconfig.json` を作成し、`target: "ES2022"`, `moduleResolution: "bundler"`, `module: "ESNext"`, `strict: true` など設計に沿ったオプションを定義する。
  - `tsdown.config.ts` を追加し、`entry` に `src/index.ts` と `src/cli.ts` を登録、`format: ['esm']`, `dts: true`, `sourcemap: true`, `clean: true`, `banner: { js: '#!/usr/bin/env node' }` を設定する。
  - `src/index.ts` と `src/cli.ts` に最小限のプレースホルダーを追加してビルド対象を確保する。
  - _Requirements: 2.1, 2.2, 2.3_
- [ ]  2.2 ビルドスクリプトと動作確認
  - `package.json` の `scripts` に `dev`, `build` を追加し、tsdown を watch と通常ビルドで呼び出す設定を行う。
  - `pnpm run build` を実行して `dist/` に ESM ファイルと型定義が生成されることを検証する。
  - _Requirements: 2.1_

- [ ]  3. コード品質ツールの導入
- [ ]  3.1 ESLint (Flat Config) の設定
  - `eslint.config.mjs` を作成し、`@typescript-eslint` プラグインと推奨設定、Prettier との競合解消を組み込む。
  - `scripts.lint` を `eslint .` に設定し、`dist` ディレクトリなど不要領域を除外する。
  - _Requirements: 3.1, 3.2_
- [ ]  3.2 Prettier の設定
  - `prettier.config.mjs` を追加し、シングルクォートやトレーリングカンマ等のスタイル方針を定義する。
  - `scripts.format` と `scripts.format:check` を設定し、Prettier の整形と検証を実行できるようにする。
  - _Requirements: 3.1, 3.3_

- [ ]  4. テスト基盤とサンプルの準備
- [ ]  4.1 Vitest 設定とサンプルテスト
  - `vitest.config.ts` を作成し、`test/**/*.test.ts` を対象に Node 環境で実行する設定を定義する。
  - `test/smoke.test.ts` に最小テストを作成し、Vitest が実行できることを確かめる。
  - `scripts.test` と `scripts.test:watch` を追加し、CI 用の `scripts.ci` に `format`, `typecheck`, `lint`, `test` を連結する。
  - _Requirements: 4.1, 4.2, 4.3_

- [ ]  5. 動作確認と最終調整
  - `pnpm run format`, `pnpm run lint`, `pnpm run test`, `pnpm run build` を順に実行し、エラーなく完走することを確認する。
  - `package.json` の `files` 配列や `.gitignore` を整備し、不要ファイルが配布やリポジトリに含まれないよう調整する。
  - _Requirements: 1.1, 2.1, 3.1, 4.1_
