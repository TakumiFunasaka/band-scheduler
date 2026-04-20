# Band Scheduler

社内バンド部の日程調整 & 曲決めアプリ。

- Vite + React + TypeScript（フロント）
- Supabase（DB + Edge Functions）
- イベント単位のパスワード認証（Edge Function でbcrypt検証 → 短命JWT発行 → Supabase RLS で `event_id` claim 検証）
- Last.fm API で「雑に人気曲を眺めるコーナー」

## 構成

```
band-scheduler/
├── src/                  React SPA
│   ├── pages/            Home / CreateEvent / EventPage
│   ├── components/       PasswordGate / ParticipantForm / ScheduleView / SongsView
│   └── lib/              supabase / api / auth / scoring / types
└── supabase/
    ├── schema.sql        1回だけ実行する初期化SQL
    └── functions/
        ├── create_event/   新規募集回 + JWT発行
        ├── join_event/     パスワード検証 + JWT発行
        └── popular_songs/  Last.fm プロキシ
```

## セットアップ手順

### 1. 依存インストール

```sh
npm install
```

### 2. Supabase プロジェクト準備

1. https://supabase.com/ で新規プロジェクト作成（Region: Tokyo 推奨）
2. Settings → API から以下を控える：
   - `Project URL`
   - `anon public` key
   - `service_role` key（ローカルに漏らさない）
   - `JWT Settings → JWT Secret`
3. SQL Editor で `supabase/schema.sql` の中身を貼り付けて実行

### 3. ローカル環境変数

`.env.local` に以下をセット：

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### 4. Supabase CLI で Edge Functions をデプロイ

Supabase CLI をインストール（未インストールの場合）:

```sh
brew install supabase/tap/supabase
```

プロジェクトをリンクして secrets と関数をデプロイ:

```sh
# プロジェクトID は Supabase ダッシュボードのURLから拾う（xxx.supabase.co の xxx 部分）
supabase link --project-ref <project-ref>

# secrets 設定（プロジェクトのJWT SecretとLast.fm APIキー）
supabase secrets set \
  JWT_SECRET="<Supabaseの JWT Secret>" \
  LASTFM_API_KEY="<Last.fm API key>"

# Edge Functions デプロイ
supabase functions deploy create_event
supabase functions deploy join_event
supabase functions deploy popular_songs
```

### 5. ローカル起動

```sh
npm run dev
```

http://localhost:5173/ で表示。募集回作成 → パスワード入力 → 参加登録 → 回答・曲ピックの全フローが動くことを確認。

### 6. GitHub Pages デプロイ

#### ⚠️ 注意: プライベートリポジトリの制約
GitHub Pages の無料プランは **public repo のみ** 対応。private repo で Pages を使うには GitHub Pro プランが必要です。選択肢：

- **(A)** リポジトリを public に変える（コードに秘密情報は含まれていない）
- **(B)** 代替ホスティング（Cloudflare Pages / Vercel / Netlify、いずれも private repo 対応かつ無料枠あり）
- **(C)** GitHub Pro に課金

以下は (A) 選択時の手順です。

#### Pages を有効化

リポジトリ Settings → Pages で **Source: GitHub Actions** を選択。

#### Actions secrets を登録

Settings → Secrets and variables → Actions に以下を追加：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

#### デプロイ

`main` ブランチに push すれば自動デプロイ。

公開URL: `https://<username>.github.io/band-scheduler/`

## 認証の仕組み（メモ）

1. `create_event` / `join_event` Edge Function は service role で DB 操作し、bcrypt で password 検証
2. 成功すると `{ role: 'authenticated', event_id, sub: event-<uuid>, exp }` を claim に持つ JWT を `JWT_SECRET`（Supabase の JWT Secret）で HS256 署名して返却
3. フロントは `sessionStorage` に保存し、以降の Supabase クエリに Authorization ヘッダで添付
4. RLS ポリシーが `auth.jwt() ->> 'event_id'` をチェック → 他イベントのデータは見えない

## 運用メモ

- 1イベント = バンド練1回の週次運用を想定。古いイベントは手動で削除推奨
- 曲候補は開催回ごとに閉じる（イベント削除で一緒に消える）
- バランススコアは Dr+Ba+(Gt|Key)+Vo が揃う日を 1.5倍。ロジックは `src/lib/scoring.ts`
