# AI LP STUDIO — 本番公開前 E2E テストチェックリスト

> **凡例**  
> 🔴 Critical（本番ブロッカー） 🟠 High（リリース前必須） 🟡 Medium（できれば確認） 🟢 Low（後回し可）  
> ✅ = 合格 ❌ = 不合格 ⏭ = スキップ

---

## 📋 テスト実施情報

| 項目 | 内容 |
|---|---|
| テスト日時 | |
| テスト担当者 | |
| 環境 | Staging / Production |
| Square モード | Sandbox / Production |
| ブラウザ | Chrome / Safari / Firefox |
| 合格基準 | 🔴 Critical 全件 + 🟠 High 90% 以上 |

---

## 🗂️ カテゴリ一覧

1. [AUTH — 認証](#1-auth--認証)
2. [BILLING — 課金・Square](#2-billing--課金square)
3. [TRIAL — トライアルプラン](#3-trial--トライアルプラン)
4. [PRO — Proプラン](#4-pro--proプラン)
5. [EDITOR — エディター](#5-editor--エディター)
6. [AUTOSAVE — 自動保存・クラウド保存](#6-autosave--自動保存クラウド保存)
7. [PUBLISH — LP公開](#7-publish--lp公開)
8. [SEO — SEO・OGP](#8-seo--seoogp)
9. [FORMS — フォーム設定](#9-forms--フォーム設定)
10. [LEADS — リード管理](#10-leads--リード管理)
11. [WEBHOOK — Webhook通知](#11-webhook--webhook通知)
12. [EMAIL — Resendメール通知](#12-email--resendメール通知)
13. [SHEETS — Google Sheets連携](#13-sheets--google-sheets連携)
14. [PERMISSIONS — 権限・RLS](#14-permissions--権限rls)
15. [SECURITY — スパム対策・セキュリティ](#15-security--スパム対策セキュリティ)
16. [MOBILE — モバイル表示](#16-mobile--モバイル表示)
17. [PERFORMANCE — 速度・Lighthouse](#17-performance--速度lighthouse)

---

## 1. AUTH — 認証

| # | 優先 | チェック | テスト内容 | 期待結果 | 失敗時の原因候補 |
|---|---|---|---|---|---|
| A-01 | 🔴 | ☐ | Google ログインボタンをクリック | OAuth 画面が開く | `GOOGLE_CLIENT_ID` 未設定 / Supabase OAuth 未構成 |
| A-02 | 🔴 | ☐ | Google アカウントで認証完了 | エディター画面にリダイレクト、ユーザー名表示 | `NEXT_PUBLIC_APP_URL` 誤り / callback URL 未登録 |
| A-03 | 🔴 | ☐ | ログアウトボタンをクリック | セッション破棄、ログイン状態解除 | `signOut()` エラー |
| A-04 | 🟠 | ☐ | 未ログイン状態で `/my-lps` へ直接アクセス | `/` にリダイレクト | auth-context のリダイレクト未実装 |
| A-05 | 🟠 | ☐ | 未ログイン状態で `/leads` へ直接アクセス | `/` にリダイレクト | leads ページの auth チェック |
| A-06 | 🟡 | ☐ | 別タブでログアウト後、元タブを操作 | 次の API 呼び出しで 401、再ログイン促進 | セッション同期 |
| A-07 | 🟡 | ☐ | トークン有効期限切れ後に保存操作 | 再認証プロンプト or エラートースト表示 | トークンリフレッシュ |
| A-08 | 🟢 | ☐ | 同じアカウントで複数ブラウザ同時ログイン | 両方で正常動作 | セッション競合 |

---

## 2. BILLING — 課金・Square

> **⚠ Sandbox でのみ実施。本番カードは使用禁止**

| # | 優先 | チェック | テスト内容 | 期待結果 | 失敗時の原因候補 |
|---|---|---|---|---|---|
| B-01 | 🔴 | ☐ | `/pricing` を開く | プラン比較ページが正常表示 | ルーティングエラー |
| B-02 | 🔴 | ☐ | Trial ユーザーで「Pro にアップグレード」クリック | Square Checkout ページへリダイレクト | `SQUARE_ACCESS_TOKEN` 未設定 / Checkout リンク生成失敗 |
| B-03 | 🔴 | ☐ | Sandbox カード `4111 1111 1111 1111` で決済完了 | `/billing/success` にリダイレクト | Square Sandbox 設定ミス |
| B-04 | 🔴 | ☐ | 決済完了後のプラン確認 | `plan_type = "pro"` に更新、PlanBadge が「Pro」表示 | Webhook 受信失敗 / `billing_status` 更新漏れ |
| B-05 | 🔴 | ☐ | Square Webhook の署名検証 | 正しいシークレットで 200、不正シークレットで 400 | `SQUARE_WEBHOOK_SIGNATURE_KEY` 未設定 |
| B-06 | 🟠 | ☐ | 決済失敗カード `4000 0000 0000 0002` 使用 | エラーメッセージ表示、プラン変更なし | Square エラーハンドリング |
| B-07 | 🟠 | ☐ | `/billing` ページを開く（Pro ユーザー） | 現在のプラン・更新日・解約ボタンが表示 | billing status API エラー |
| B-08 | 🟠 | ☐ | 解約ボタンをクリック → 確認 → 実行 | `billing_status = "canceled"` に更新、期間終了まで Pro 利用可 | Square Subscription 解約 API |
| B-09 | 🟠 | ☐ | `past_due` 状態のシミュレーション | Grace Period（3日）バナー表示 | `grace_period_ends_at` 計算ミス |
| B-10 | 🟠 | ☐ | Grace Period 終了後の状態 | `plan_type = "expired"` に移行、機能ロック | バッチ or Webhook トリガー未設定 |
| B-11 | 🟡 | ☐ | GlobalBanners の Trial 残り日数表示 | 正確な残り日数（1日・3日・7日の閾値確認） | `trialDaysLeft()` 計算ミス |
| B-12 | 🟡 | ☐ | Expired ユーザーで全機能を試行 | 全機能ロック、アップグレードモーダル表示 | `canEdit: false` 未チェック |
| B-13 | 🟢 | ☐ | 管理者ページ `/admin/billing` | リード・課金状況が一覧表示 | 管理者権限チェック |

---

## 3. TRIAL — トライアルプラン

| # | 優先 | チェック | テスト内容 | 期待結果 | 失敗時の原因候補 |
|---|---|---|---|---|---|
| T-01 | 🔴 | ☐ | Trial ユーザーで LP 生成（1回目） | 成功 | — |
| T-02 | 🔴 | ☐ | Trial ユーザーで LP 生成（4回目以降） | ブロック + アップグレードモーダル表示 | `isLimitReached()` 未チェック |
| T-03 | 🔴 | ☐ | Trial ユーザーで HTML タブの「コピー」クリック | LockScreen 表示（Pro 限定） | `canExport: false` 未チェック |
| T-04 | 🔴 | ☐ | Trial ユーザーで「🚀 公開」ボタンクリック | PublishPanel 内でロック画面表示 | `canPublish: false` 未チェック |
| T-05 | 🔴 | ☐ | Trial ユーザーが公開LPのフォームを送信 | 「Pro プランでご利用いただけます」エラー | submit API の plan チェック |
| T-06 | 🟠 | ☐ | Trial ユーザーでクラウド保存（2プロジェクト目） | ブロック（maxProjects: 1） | プロジェクト数チェック |
| T-07 | 🟠 | ☐ | Trial ユーザーでプレビュー URL（`/preview/[id]`）にアクセス | プレビュー正常表示（認証不要） | preview ページのアクセス制御 |
| T-08 | 🟡 | ☐ | Trial ユーザーで AI 編集（11回目以降） | ブロック（maxAiEdit: 10） | `ai_edit` カウント |

---

## 4. PRO — Proプラン

| # | 優先 | チェック | テスト内容 | 期待結果 | 失敗時の原因候補 |
|---|---|---|---|---|---|
| P-01 | 🔴 | ☐ | Pro ユーザーで LP 生成（100回まで） | 全件成功 | 上限値チェック |
| P-02 | 🔴 | ☐ | Pro ユーザーで HTML をコピー | コピー成功 | `canExport: true` |
| P-03 | 🔴 | ☐ | Pro ユーザーで LP 公開 | 公開成功、公開 URL が表示 | publish API エラー |
| P-04 | 🔴 | ☐ | Pro ユーザーの公開 LP でフォーム送信 | 送信成功、リードが保存される | submit API の Pro チェック |
| P-05 | 🟠 | ☐ | Pro ユーザーで 10 プロジェクト保存 | 10件まで成功、11件目でブロック | maxProjects チェック |
| P-06 | 🟠 | ☐ | Pro アップグレード直後の使用量リセット | 月間カウンターがリセット | Webhook トリガー後の usage リセット |

---

## 5. EDITOR — エディター

| # | 優先 | チェック | テスト内容 | 期待結果 | 失敗時の原因候補 |
|---|---|---|---|---|---|
| E-01 | 🔴 | ☐ | フォーム入力して「生成する」クリック | 30秒以内に LP HTML/CSS が生成・表示 | API キー / Claude API タイムアウト |
| E-02 | 🔴 | ☐ | プレビュー内テキストをダブルクリック編集 | テキスト直接編集モードが起動 | contenteditable / iframe 通信 |
| E-03 | 🟠 | ☐ | スタイルモード → 要素クリック → 色変更 | VisualStylePanel 表示、色がリアルタイム反映 | selectedElement 更新 |
| E-04 | 🟠 | ☐ | 画像モード → 要素クリック → 画像挿入 | ImageInsertPanel 表示、画像が反映 | upload API / base64 変換 |
| E-05 | 🟠 | ☐ | セクション追加ボタン → セクション選択 | LP に新セクション追加 | AddSectionModal / AI 生成 |
| E-06 | 🟠 | ☐ | セクション並び替え（ドラッグ&ドロップ） | HTML 内の順序が変更 | reorderHtmlSections |
| E-07 | 🟠 | ☐ | セクション削除 → 確認ダイアログ → 実行 | セクションが削除 | 確認モーダル / DOM 操作 |
| E-08 | 🟠 | ☐ | Undo（Ctrl+Z）を複数回実行 | 変更が順次取り消し | undoStack |
| E-09 | 🟠 | ☐ | カラーテーマ変更 | LP の配色がリアルタイム変更 | replaceColors |
| E-10 | 🟠 | ☐ | フォント変更（Google Fonts） | プレビューのフォントが変更 | buildFontCss / googleFontsUrl |
| E-11 | 🟡 | ☐ | AI 修正「ボタンの色を赤に変更して」 | 指定箇所が修正 | revise API |
| E-12 | 🟡 | ☐ | PC↔モバイルプレビュー切り替え | iframe サイズが変更 | previewMode |
| E-13 | 🟡 | ☐ | 参考 LP 解析（URL 入力）| 競合他社の情報が解析・反映 | analyze-site API |
| E-14 | 🟢 | ☐ | Netlify タブの「DL」ボタン | スタンドアロン HTML ダウンロード | buildNetlifyHtml |

---

## 6. AUTOSAVE — 自動保存・クラウド保存

| # | 優先 | チェック | テスト内容 | 期待結果 | 失敗時の原因候補 |
|---|---|---|---|---|---|
| AS-01 | 🔴 | ☐ | LP 生成後にページリロード | ローカル保存データが復元バナーで確認促進 | `saveToLocal()` |
| AS-02 | 🔴 | ☐ | 「クラウドに保存」クリック（初回） | Supabase に保存、project ID が付与 | `/api/projects` POST |
| AS-03 | 🔴 | ☐ | クラウド保存後にページリロード → `?p=id` でアクセス | クラウドデータが読み込まれる | `/api/projects/[id]` GET |
| AS-04 | 🟠 | ☐ | 変更後 3 秒でオートセーブ（クラウド保存済み状態） | 「保存中」→「保存済み」インジケーター表示 | autosave timer / cloud PATCH |
| AS-05 | 🟠 | ☐ | マイ LP ページで保存プロジェクト一覧表示 | プロジェクト一覧が表示 | `/my-lps` ページ |
| AS-06 | 🟠 | ☐ | マイ LP から既存プロジェクトを開く | エディターにデータ読み込み | project load flow |
| AS-07 | 🟡 | ☐ | 「JSON をダウンロード」 | ブラウザでファイル保存 | `downloadProject()` |
| AS-08 | 🟡 | ☐ | JSON ファイルを「読み込む」で復元 | エディターにデータ読み込み | `parseProjectFile()` |

---

## 7. PUBLISH — LP公開

| # | 優先 | チェック | テスト内容 | 期待結果 | 失敗時の原因候補 |
|---|---|---|---|---|---|
| PB-01 | 🔴 | ☐ | Pro ユーザーで「🚀 公開」→「設定を保存」→「公開する」 | スラグ生成、`is_published = true`、公開URLが PublishPanel に表示 | publish API / slug 重複 |
| PB-02 | 🔴 | ☐ | 公開 URL（`/p/[slug]`）に未ログインでアクセス | LP が正常表示（認証不要） | Server Component / SSR |
| PB-03 | 🔴 | ☐ | 未公開プロジェクトの `/p/[slug]` にアクセス | 404 表示 | `is_published` フィルタ |
| PB-04 | 🔴 | ☐ | 「非公開にする」ボタン → 実行 | `is_published = false`、公開 URL が 404 に | unpublish API |
| PB-05 | 🟠 | ☐ | プレビュー URL（`/preview/[id]`）に未ログインでアクセス | プレビューバナー付きで表示 | UUID アクセス制御 |
| PB-06 | 🟠 | ☐ | 公開 LP の `<head>` を確認 | `<title>` が SEO タイトル、`description` が設定値 | `generateMetadata()` |
| PB-07 | 🟠 | ☐ | noindex ON のプロジェクトを公開 | レスポンスヘッダーに `noindex, nofollow` | `robots` metadata |
| PB-08 | 🟠 | ☐ | 日本語タイトルのプロジェクトを公開 | `lp-{random}` 形式のスラグが生成 | `titleToSlug()` fallback |
| PB-09 | 🟡 | ☐ | 同じスラグ名が存在する状態で別プロジェクトを公開 | `-2` サフィックスで一意なスラグが生成 | slug 重複回避ループ |
| PB-10 | 🟡 | ☐ | 公開中バナーの「公開URLを開く」クリック | 新タブで公開 URL が開く | `appUrl` 設定 |

---

## 8. SEO — SEO・OGP

| # | 優先 | チェック | テスト内容 | 期待結果 | 失敗時の原因候補 |
|---|---|---|---|---|---|
| SEO-01 | 🔴 | ☐ | 公開 LP ページのソースを確認 | `<title>`, `<meta name="description">` が正しく設定 | `generateMetadata()` |
| SEO-02 | 🔴 | ☐ | OGP 画像 URL を設定し公開 | `<meta property="og:image">` に URL が出力 | og_image 保存 / SSR |
| SEO-03 | 🟠 | ☐ | Twitter Card のタグ確認 | `<meta name="twitter:card" content="summary_large_image">` | generateMetadata の twitter 設定 |
| SEO-04 | 🟠 | ☐ | favicon URL を設定し確認 | `<link rel="icon">` に favicon URL | icons 設定 |
| SEO-05 | 🟠 | ☐ | プレビュー URL の robots タグ | `<meta name="robots" content="noindex, nofollow">` | preview ページの generateMetadata |
| SEO-06 | 🟠 | ☐ | custom_head_html に GA タグを設定し公開 | `<head>` 内に GA スクリプトが挿入・実行 | HeadInjector / `<script>` 再作成 |
| SEO-07 | 🟡 | ☐ | SEOChecker（エディター内）の表示 | title / description 文字数、見出し構造の診断 | SEOChecker コンポーネント |
| SEO-08 | 🟡 | ☐ | OGP 確認ツール（ogp.me等）でプレビュー | OGP 画像・タイトルが正しく表示 | SSR でのメタ出力 |

---

## 9. FORMS — フォーム設定

| # | 優先 | チェック | テスト内容 | 期待結果 | 失敗時の原因候補 |
|---|---|---|---|---|---|
| F-01 | 🔴 | ☐ | エディターで「フォームを有効にする」ON → 保存 | `form_config.enabled = true` が DB に保存 | form-config PATCH API |
| F-02 | 🔴 | ☐ | 公開 LP を開く | 右下に「✉ お問い合わせ」フローティングボタン表示 | FormWidget 表示 |
| F-03 | 🔴 | ☐ | フローティングボタンクリック | モーダルが開く | FormModal |
| F-04 | 🔴 | ☐ | 必須項目を空にして送信 | 「必須です」バリデーションエラー表示 | クライアントバリデーション |
| F-05 | 🔴 | ☐ | 全項目入力して送信（Pro ユーザー） | 「ありがとうございます」完了メッセージ表示 | submit API / lead 保存 |
| F-06 | 🔴 | ☐ | Trial LP のフォームを送信 | 「Pro プランでご利用いただけます」エラー | plan チェック |
| F-07 | 🟠 | ☐ | フィールド追加（タイプ: select） | 選択肢が表示、正常送信 | FormField type = select |
| F-08 | 🟠 | ☐ | フィールド追加（タイプ: checkbox） | 複数選択、カンマ区切りで payload に格納 | checkbox 処理 |
| F-09 | 🟠 | ☐ | フィールド順序変更（↑↓ボタン） | 変更後の順序で保存・表示 | order フィールド |
| F-10 | 🟠 | ☐ | 送信完了メッセージをカスタム変更 | 変更後のメッセージが表示 | successMessage |
| F-11 | 🟠 | ☐ | リダイレクト URL 設定 → 送信 | 2秒後にリダイレクト | window.location.href |
| F-12 | 🟠 | ☐ | メールアドレス不正形式で送信 | 「形式が正しくありません」エラー | email バリデーション |
| F-13 | 🟡 | ☐ | ESC キーでモーダルを閉じる | モーダルが閉じる | keydown handler |
| F-14 | 🟡 | ☐ | モーダル外背景クリックで閉じる | モーダルが閉じる | backdrop onClick |
| F-15 | 🟡 | ☐ | 送信完了後にモーダルを再開 | 入力値がリセットされ空フォームが表示 | state reset |

---

## 10. LEADS — リード管理

| # | 優先 | チェック | テスト内容 | 期待結果 | 失敗時の原因候補 |
|---|---|---|---|---|---|
| L-01 | 🔴 | ☐ | `/leads` ページにアクセス | リード一覧が表示 | leads ページ / API |
| L-02 | 🔴 | ☐ | フォーム送信後に `/leads` を確認 | 新着リードが一覧に表示（ステータス: 新規） | leads API / user_id フィルタ |
| L-03 | 🔴 | ☐ | リードをクリックして詳細表示 | 全フィールドの送信内容が確認できる | LeadDetail |
| L-04 | 🔴 | ☐ | ステータスを「対応済」に変更 | ステータスバッジが緑に変わる | leads PATCH API |
| L-05 | 🟠 | ☐ | 「⬇ CSV」ボタンをクリック | UTF-8 BOM 付き CSV がダウンロード | export API / Blob 処理 |
| L-06 | 🟠 | ☐ | CSV を Excel で開く | 文字化けなし、全フィールドが正確 | BOM 付き UTF-8 |
| L-07 | 🟠 | ☐ | ステータスフィルタ「新規」で絞り込み | 新規のみ表示 | status クエリ |
| L-08 | 🟠 | ☐ | 検索ボックスに名前を入力 | 一致するリードに絞り込み | `payload::text ILIKE` |
| L-09 | 🟡 | ☐ | 50件超のリードでページネーション | 次ページが正常動作 | page / per_page |
| L-10 | 🟡 | ☐ | 他ユーザーのリードを `/api/leads?project_id=他人` でアクセス | 0件返却 | user_id フィルタ / RLS |

---

## 11. WEBHOOK — Webhook通知

| # | 優先 | チェック | テスト内容 | 期待結果 | 失敗時の原因候補 |
|---|---|---|---|---|---|
| WH-01 | 🔴 | ☐ | Webhook URL を設定して ON → フォーム送信 | 指定 URL に POST が届く | webhook 送信コード |
| WH-02 | 🔴 | ☐ | 受信した payload の構造確認 | `event`, `project`, `lead`, `data` フィールドが揃っている | WebhookPayload 型 |
| WH-03 | 🟠 | ☐ | Secret Token を設定 | `X-Webhook-Secret` ヘッダーで送信される | secretToken 設定 |
| WH-04 | 🟠 | ☐ | Webhook URL が 500 エラーを返す | リード保存は成功、エラーログのみ | エラーハンドリング（Promise.allSettled） |
| WH-05 | 🟠 | ☐ | Webhook URL が存在しない | タイムアウト後も正常レスポンスを返す | fetch タイムアウト |
| WH-06 | 🟡 | ☐ | Zapier Webhook でテスト | Zapier 側でデータ受信確認 | CORS / Content-Type |
| WH-07 | 🟡 | ☐ | Make (Integromat) でテスト | Make 側でデータ受信確認 | — |
| WH-08 | 🟢 | ☐ | n8n でテスト | n8n 側でデータ受信確認 | — |

---

## 12. EMAIL — Resendメール通知

| # | 優先 | チェック | テスト内容 | 期待結果 | 失敗時の原因候補 |
|---|---|---|---|---|---|
| EM-01 | 🔴 | ☐ | `RESEND_API_KEY` 設定後にフォーム送信 | 通知メールがオーナーのアドレスに届く | API キー / FROM_EMAIL |
| EM-02 | 🔴 | ☐ | メール本文の確認 | LP名・送信内容・送信日時・公開 URL が含まれる | buildLeadNotificationHtml |
| EM-03 | 🟠 | ☐ | カスタム送信先メール設定 | 設定アドレスにメール送信 | emailNotification.toEmail |
| EM-04 | 🟠 | ☐ | メールの HTML レンダリング確認 | Gmail / Apple Mail でレイアウト崩れなし | インラインスタイル |
| EM-05 | 🟠 | ☐ | `RESEND_API_KEY` 未設定の場合 | エラーにならず警告ログのみ | no-op fallback |
| EM-06 | 🟡 | ☐ | スパムフォルダに入らないか確認 | 受信箱に届く | FROM_EMAIL のドメイン認証 |
| EM-07 | 🟡 | ☐ | Resend ダッシュボードで送信ログ確認 | 成功ステータスが記録されている | Resend API レスポンス |

---

## 13. SHEETS — Google Sheets連携

| # | 優先 | チェック | テスト内容 | 期待結果 | 失敗時の原因候補 |
|---|---|---|---|---|---|
| SH-01 | 🟠 | ☐ | `GOOGLE_SERVICE_ACCOUNT_JSON` 設定後にフォーム送信 | Sheets に新しい行が追加される | JWT 生成 / Sheets API |
| SH-02 | 🟠 | ☐ | 追加された行の内容確認 | 送信日時・フォームデータ・リファラーが正しい列に入る | row 構造 |
| SH-03 | 🟠 | ☐ | Sheet URL を設定（URL 形式） | スプレッドシート ID を自動抽出して動作 | extractSpreadsheetId() |
| SH-04 | 🟠 | ☐ | サービスアカウントに「編集者」権限がない場合 | エラーログのみ、リード保存は成功 | エラーハンドリング |
| SH-05 | 🟡 | ☐ | `GOOGLE_SERVICE_ACCOUNT_JSON` 未設定の場合 | スキップ（警告ログのみ） | no-op fallback |
| SH-06 | 🟡 | ☐ | シート名を「リード」に変更して設定 | 指定したシートタブに行追加 | sheetName 設定 |

---

## 14. PERMISSIONS — 権限・RLS

| # | 優先 | チェック | テスト内容 | 期待結果 | 失敗時の原因候補 |
|---|---|---|---|---|---|
| PR-01 | 🔴 | ☐ | ユーザー A のプロジェクト ID で B がアクセス | 404 または 403 を返す | RLS / user_id チェック |
| PR-02 | 🔴 | ☐ | ユーザー A の leads を B が `/api/leads` で取得 | 0件（B のリードのみ返却） | RLS `user_id = auth.uid()` |
| PR-03 | 🔴 | ☐ | 未認証で `/api/projects` に POST | 401 Unauthorized | getUserFromRequest |
| PR-04 | 🔴 | ☐ | 未認証で `/api/leads` に GET | 401 Unauthorized | getUserFromRequest |
| PR-05 | 🟠 | ☐ | Trial ユーザーが Pro 限定 API を直接呼び出し | 403 + `code: "PLAN_LIMIT"` | 各 API の plan チェック |
| PR-06 | 🟠 | ☐ | 存在しないプロジェクト ID でリード詳細更新 | 404 | oーナー確認ロジック |
| PR-07 | 🟡 | ☐ | Supabase ダッシュボードで RLS の有効確認 | leads, projects テーブルに RLS 設定済み | RLS policy |

---

## 15. SECURITY — スパム対策・セキュリティ

| # | 優先 | チェック | テスト内容 | 期待結果 | 失敗時の原因候補 |
|---|---|---|---|---|---|
| SC-01 | 🔴 | ☐ | Honeypot フィールド（`_hp`）に値を入れてリクエスト | `{ success: true }` を返す（ボット誤誘導）、DB には保存しない | honeypot チェック |
| SC-02 | 🔴 | ☐ | 同一 IP から 1 時間に 6 回送信 | 6回目に 429 Too Many Requests | rate limit チェック |
| SC-03 | 🔴 | ☐ | 10秒以内に連続送信 | 2回目に 429 | 送信間隔制限 |
| SC-04 | 🟠 | ☐ | 必須項目に 5001 文字を送信 | 422 バリデーションエラー | 最大文字数チェック |
| SC-05 | 🟠 | ☐ | メールアドレス欄に `<script>alert(1)</script>` | エスケープされてそのまま保存、XSS なし | HTML エスケープ |
| SC-06 | 🟠 | ☐ | 未公開スラグへのフォーム送信 | 404 | is_published チェック |
| SC-07 | 🟡 | ☐ | `custom_head_html` に悪意ある script | Pro ユーザー自身のページにのみ影響（設計上許容） | セキュリティポリシー確認 |
| SC-08 | 🟡 | ☐ | `/api/submit/[slug]` に巨大なリクエストボディ | 413 または適切なエラー | Next.js body size limit |
| SC-09 | 🟢 | ☐ | CORS ヘッダーの確認 | 他ドメインからの API 呼び出しが適切に制限 | Next.js CORS 設定 |

---

## 16. MOBILE — モバイル表示

| # | 優先 | チェック | デバイス/解像度 | 確認内容 | 失敗時の原因候補 |
|---|---|---|---|---|---|
| M-01 | 🔴 | ☐ | iPhone SE（375px） | 公開 LP が崩れずに表示 | LP の CSS レスポンシブ |
| M-02 | 🔴 | ☐ | iPhone 14（390px） | フォームモーダルが全画面で使いやすい | FormModal の mobile スタイル |
| M-03 | 🔴 | ☐ | Android Chrome（360px） | フローティングボタンが他要素と重ならない | z-index / fixed 位置 |
| M-04 | 🟠 | ☐ | iPad（768px） | エディター左パネルが正常表示 | aside のレスポンシブ |
| M-05 | 🟠 | ☐ | モバイルでフォーム送信 | キーボードが出てもモーダルが操作可能 | max-height / scroll |
| M-06 | 🟠 | ☐ | モバイルでプレビューバナー（`/preview`） | バナーが読みやすく、「編集する」リンクが押せる | sticky banner |
| M-07 | 🟠 | ☐ | `/leads` ページをモバイルで表示 | テーブルがスクロール可能 | overflow-x |
| M-08 | 🟡 | ☐ | モバイルでヘッダーのボタン確認 | 「🚀」「💾」等のボタンが押しやすい | shrink-0 / touch target |
| M-09 | 🟡 | ☐ | Safari iOS でフォーム入力 | 自動ズームが起きない（font-size 16px以上） | input の font-size |
| M-10 | 🟡 | ☐ | モバイルでのページ表示速度 | 3G 環境で 3 秒以内に First Contentful Paint | 画像最適化 |

---

## 17. PERFORMANCE — 速度・Lighthouse

### Lighthouse スコア目標値

| 指標 | 目標スコア | 現在値 | 判定 |
|---|---|---|---|
| Performance | ≥ 80 | | ☐ |
| Accessibility | ≥ 85 | | ☐ |
| Best Practices | ≥ 90 | | ☐ |
| SEO | ≥ 90 | | ☐ |

### 速度確認チェックリスト

| # | 優先 | チェック | テスト内容 | 目標値 | 失敗時の原因候補 |
|---|---|---|---|---|---|
| PF-01 | 🔴 | ☐ | 公開 LP（`/p/[slug]`）の FCP | < 1.5s | 大きな HTML / CSS / 外部フォント |
| PF-02 | 🔴 | ☐ | 公開 LP の LCP | < 2.5s | 大きな画像 / レンダリングブロック |
| PF-03 | 🟠 | ☐ | 公開 LP の TBT（Total Blocking Time） | < 200ms | JS バンドルサイズ |
| PF-04 | 🟠 | ☐ | LP 生成時間（AI API） | < 30s | Claude API レイテンシ / streaming |
| PF-05 | 🟠 | ☐ | クラウド保存のレスポンス時間 | < 2s | Supabase レイテンシ |
| PF-06 | 🟠 | ☐ | フォーム送信のレスポンス時間 | < 3s | DB + 非同期後処理 |
| PF-07 | 🟡 | ☐ | `/leads` 50件の初期ロード | < 2s | Supabase クエリ速度 |
| PF-08 | 🟡 | ☐ | 画像挿入後の LP プレビュー更新 | < 1s | base64 処理 / iframe rerender |
| PF-09 | 🟡 | ☐ | カスタムフォントの Web Font 読み込み | FOUT/FOIT 許容範囲内 | font-display 設定 |

### Lighthouse 実行手順

```bash
# Chrome DevTools > Lighthouse タブ
# または CLI で実行:
npx lighthouse https://your-domain.com/p/your-slug \
  --output=html --output-path=./lighthouse-report.html \
  --preset=desktop

# モバイル版
npx lighthouse https://your-domain.com/p/your-slug \
  --output=html --output-path=./lighthouse-mobile.html \
  --preset=mobile
```

---

## 🚀 Sandbox テスト専用チェックリスト

> Square Sandbox でのみ実施すべきテスト

| # | チェック | テスト内容 |
|---|---|---|
| SB-01 | ☐ | Sandbox カード `4111 1111 1111 1111` で決済成功 |
| SB-02 | ☐ | Sandbox カード `4000 0000 0000 0002` で決済失敗 |
| SB-03 | ☐ | Square Webhook Sandbox エンドポイントでイベント受信確認 |
| SB-04 | ☐ | 支払い成功 Webhook → `plan_type = "pro"` 更新確認 |
| SB-05 | ☐ | 支払い失敗 Webhook → `billing_status = "past_due"` 更新確認 |
| SB-06 | ☐ | 解約 Webhook → `billing_status = "canceled"` 更新確認 |
| SB-07 | ☐ | Webhook 署名検証（正しいシークレット vs 不正なシークレット） |

---

## 🚨 本番公開前に必須の確認項目

> これが全て ✅ でないとリリースしてはいけません

### 環境変数チェック
```bash
# 必須環境変数一覧
NEXT_PUBLIC_SUPABASE_URL          ✅ / ❌
NEXT_PUBLIC_SUPABASE_ANON_KEY     ✅ / ❌
SUPABASE_SERVICE_ROLE_KEY         ✅ / ❌
NEXT_PUBLIC_APP_URL               ✅ / ❌  # https://your-domain.com
SQUARE_ACCESS_TOKEN               ✅ / ❌  # 本番キー（Sandbox ではない）
SQUARE_WEBHOOK_SIGNATURE_KEY      ✅ / ❌
ANTHROPIC_API_KEY                 ✅ / ❌

# オプション（機能有効時は必須）
RESEND_API_KEY                    ✅ / ❌ / N/A
FROM_EMAIL                        ✅ / ❌ / N/A
GOOGLE_SERVICE_ACCOUNT_JSON       ✅ / ❌ / N/A
```

### インフラ確認
| # | チェック | 確認内容 |
|---|---|---|
| INF-01 | ☐ | Supabase のマイグレーション全適用（phase5, phase6 SQL） |
| INF-02 | ☐ | Square Webhook URL の登録（`https://your-domain.com/api/square/webhook`） |
| INF-03 | ☐ | Square を Sandbox → 本番に切り替え |
| INF-04 | ☐ | Supabase の RLS が有効（leads, projects テーブル） |
| INF-05 | ☐ | NEXT_PUBLIC_APP_URL が `https://` から始まる本番ドメイン |
| INF-06 | ☐ | Google OAuth のリダイレクト URI に本番ドメインを追加 |
| INF-07 | ☐ | Resend のドメイン認証が完了（SPF/DKIM） |
| INF-08 | ☐ | 本番ドメインの SSL 証明書が有効 |

---

## 🐛 高優先度バグ候補（確認必須）

| # | バグ候補 | 確認方法 | 影響 |
|---|---|---|---|
| BUG-01 | Webhook受信後のプラン更新が遅延する | 決済後30秒以内に plan_type を確認 | 課金フロー崩壊 |
| BUG-02 | 同一スラグの重複生成 | 高速連続で2プロジェクトを公開 | 404/コンフリクト |
| BUG-03 | Trial ユーザーが publish API を直接 POST で呼べる | curl で直接 POST | 課金バイパス |
| BUG-04 | フォーム送信後にメール未到達 | Resend ダッシュボードで確認 | 通知漏れ |
| BUG-05 | CSV の文字化け（Excel） | Windows Excel で開く | データ破損 |
| BUG-06 | モバイルでフォームモーダルがキーボードに隠れる | iOS Safari で実機テスト | UX 破綻 |
| BUG-07 | autosave が未ログイン状態でエラーを出す | ログアウト状態でテキスト編集 | コンソールエラー連打 |
| BUG-08 | leads の RLS が anon アクセスを許可してしまう | 未認証で /api/leads を GET | データ漏洩 |

---

## ⏭ 後回し可能な項目（リリース後でOK）

- 🟢 **Lighthouse スコア最適化**（80点以上なら後回し可）
- 🟢 **Discord / Slack Webhook 動作確認**
- 🟢 **LINE 通知テスト**
- 🟢 **n8n / Make での複雑なフロー確認**
- 🟢 **100件超のリードでのパフォーマンス**
- 🟢 **Firefox / Edge での動作確認**（Chrome / Safari 優先）
- 🟢 **ダークモード対応**
- 🟢 **PWA 対応**
- 🟢 **i18n（多言語対応）**
- 🟢 **管理者 `/admin/billing` の機能拡充**

---

## 📊 テスト進捗サマリー（記入用）

| カテゴリ | 総件数 | ✅ 合格 | ❌ 不合格 | ⏭ スキップ | 合格率 |
|---|---|---|---|---|---|
| AUTH | 8 | | | | |
| BILLING | 13 | | | | |
| TRIAL | 8 | | | | |
| PRO | 6 | | | | |
| EDITOR | 14 | | | | |
| AUTOSAVE | 8 | | | | |
| PUBLISH | 10 | | | | |
| SEO | 8 | | | | |
| FORMS | 15 | | | | |
| LEADS | 10 | | | | |
| WEBHOOK | 8 | | | | |
| EMAIL | 7 | | | | |
| SHEETS | 6 | | | | |
| PERMISSIONS | 7 | | | | |
| SECURITY | 9 | | | | |
| MOBILE | 10 | | | | |
| PERFORMANCE | 9 | | | | |
| **合計** | **166** | | | | |

---

## 🏁 リリース判定基準

| 条件 | 基準 | 結果 |
|---|---|---|
| 🔴 Critical 全件合格 | 100% | ✅ / ❌ |
| 🟠 High 合格率 | ≥ 90% | ✅ / ❌ |
| 既知の 🔴 バグなし | 0件 | ✅ / ❌ |
| 環境変数 全設定済み | 全件 ✅ | ✅ / ❌ |
| Supabase SQL 全適用済み | phase5 + phase6 | ✅ / ❌ |
| Square が本番モード | Sandbox でない | ✅ / ❌ |

> **判定**: 上記全条件を満たした場合のみ本番リリース可

---

*Last updated: 2026-05-24*
