# Implementation Plan

- [x] 1. MCP サーバーの足場を整える
  - `screenshot_app_window` ツールの入力バリデーションとサーバー起動コードを実装し、bundleId/appName が必須であることを保証する。
  - MCP レスポンスで JSON と resource の 2 コンテンツを返却し、structuredContent に同等の構造体を保持する。
  - _Requirements: 1.1, 1.2, 3.1, 3.2, 3.4_

- [x] 1.1 入力スキーマとツール登録
  - zod で `bundleId` と `appName` の必須条件と各パラメータの既定値・範囲を定義する。
  - `McpServer` にツールを登録し、起動時に stdio トランスポートへ接続する。
  - _Requirements: 1.1, 1.2, 1.3, 3.1_

- [x] 1.2 レスポンス構築
  - 撮影成功時の JSON と MCP resource を組み立て、rect/scale/format が仕様どおり含まれることを保証する。
  - エラー時は `isError: true` と分かりやすいメッセージを返却する共通処理を整備する。
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 5.1, 5.2, 5.3_

- [x] 2. JXA 実行とウィンドウ情報の取得を実装する
  - `osascript -l JavaScript` を使い、bundleId/appName から対象アプリを特定してウィンドウ座標・サイズ・スケールを取得する。
  - 複数ディスプレイ環境でウィンドウ中心のディスプレイを特定し、backingScaleFactor を適用する。
  - _Requirements: 2.1, 2.2, 5.1, 5.2_

- [x] 2.1 JXA スクリプト
  - JXA でアプリをアクティブ化し、指定 index のウィンドウを選択して position/size/scale を JSON で返すロジックを実装する。
  - `NoWindow` や `ProcessNotFound` のケースを判別し、エラーを返せるようにする。
  - _Requirements: 2.1, 2.2, 5.1, 5.2_

- [x] 2.2 ディスプレイスケールの適用
  - 取得した矩形の中心点から属するディスプレイを探索し、適切な backingScaleFactor を適用する。
  - フォールバックとして mainScreen のスケールを利用し、整数ピクセルに丸める。
  - _Requirements: 2.2_

- [x] 3. screencapture を利用した撮影パイプラインを実装する
  - JXA の結果や preferWindowId 設定に応じて `screencapture` の引数を組み立てる。
  - GetWindowID の存在を確認し、利用可能な場合は `-l` で撮影し、失敗時は矩形キャプチャへ戻す。
  - _Requirements: 2.3, 2.4_

- [x] 3.1 screencapture コマンド生成
  - `-R` と `-l` の両モードに対応する引数構築を実装し、`includeShadow` が偽なら `-o` を付与する。
  - 形式に応じて `-t png|jpg` を選択する。
  - _Requirements: 2.3, 2.4_

- [x] 3.2 GetWindowID フォールバック
  - `command -v GetWindowID` で存在を確認し、windowId 取得失敗時は例外を握りつぶして矩形モードに戻す。
  - _Requirements: 2.3_

- [x] 4. 一時ファイルと TTL 管理
  - `os.tmpdir()` 配下に固有ディレクトリを作成し、画像を保存する。
  - 応答返却後に TTL 600 秒で削除するタイマーを設定し、環境変数で調整できるようにする。
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 4.1 Temp ディレクトリ作成
  - `fs.mkdtemp` で `mcp-screenshot-` プレフィックスのディレクトリを作成し、ファイルパスを組み立てる。
  - _Requirements: 4.1_

- [x] 4.2 TTL スケジューリング
  - `setTimeout` で削除を予約し、TTL 変更や 0 の場合の無効化に対応する。
  - 削除失敗時は警告ログに留める。
  - _Requirements: 4.2, 4.3, 4.4_

- [x] 5. エラー処理とタイムアウト適用
  - JXA と screencapture の呼び出しに `timeoutMs` を適用し、超過時はプロセスを終了させる。
  - エラー種別ごとにメッセージを整形し、MCP レスポンスへ反映する。
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 6. テストと検証
  - バリデーション・JXA 実行・TTL 管理・エラー応答などの単体テストを実装する。
  - 実機確認用の手順を整備し、README に権限付与や利用方法を追記する。
  - _Requirements: 1.1, 2.1, 2.3, 4.1, 5.1_
