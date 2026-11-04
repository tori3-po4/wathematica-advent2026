# Wathematica Advent Calendar — Front

Astroで生成する静的なアドベントカレンダーです。Botが保存する
`content/<id>/article.json`、PNGアイコン、Markdown／PDFをビルド時に読み込みます。
Bot側のデータ形式や投稿処理は変更していません。

## 起動・ビルド

Node.js 22.23.4以上を使用してください。リポジトリの`nix develop`でもNode.jsを利用できます。

```sh
cd Front
npm ci
npm run dev
```

本番と同じ静的ファイルの確認:

```sh
npm run build
npm test
npm run preview
```

`npm run build`で`dist/index.html`が生成されます。このHTMLは直接ブラウザで開いても動作します。
`npm test`には生成物の検証が含まれるため、先にビルドしてください。
依存関係のインストール時のnpm監査は無効にしていません。

## 通信と公開日の扱い

- HTMLの初回取得後は、カレンダー、検索、Markdown本文の表示、PDFのダウンロードに追加通信は発生しません。
- CSS、JavaScript、著者アイコン、Markdown本文、PDFはすべてHTMLに埋め込みます。外部フォント、CDN、分析スクリプト、API、認証、データベースを使用しません。
- 本番HTMLのContent Security Policyは`connect-src 'none'`です。JavaScriptとCSSは内容のハッシュで許可し、画像は埋め込みの`data:`だけを許可します。
- 日付は端末時計を日本時間（UTC+9）に変換し、各日0:00から表示します。ページを開いたままの日付変更と、タブへ戻った際の再判定にも対応します。NTPは使用しません。
- 12月25日以降や翌年も公開済み記事を閲覧できます。
- 外部記事やMarkdown内のHTTPSリンクは、読者がクリックした場合だけ別タブで開きます。移動先への通信は発生します。
- 開発時の`npm run dev`にはAstro/Viteの開発用通信があります。無通信の確認には`npm run build`の生成物を使用してください。ホスティング側でも分析タグ等を自動挿入しない設定にしてください。

**公開日による表示制御は秘密保持の仕組みではありません。** 未公開の記事も生成HTMLには含まれるため、ソース閲覧や端末時計の変更で読むことができます。厳密な事前非公開が必要な場合は、公開前の本文を配布せず、公開日に再ビルドする運用が別途必要です。

## 記事データ

Botの出力をそのまま配置します。パスの基準は`Front/`です。

```text
content/
└── <id>/
    ├── article.json
    ├── icon.png
    └── article.md       # PDFの場合はarticle.pdf、外部URLなら不要
```

```json
{
  "id": "example",
  "date": "2026-12-01",
  "title": "記事のタイトル",
  "author": "著者名",
  "icon": "content/example/icon.png",
  "abstract": "**Markdown**で書いた概要です。",
  "content": {
    "type": "markdown",
    "path": "content/example/article.md"
  }
}
```

PDFは`{"type":"pdf","path":"content/example/article.pdf"}`、外部記事は
`{"type":"external","url":"https://example.com/article"}`を使用します。
同じ日への複数投稿に対応しています。記事がない状態でもビルドでき、空のカレンダーを表示します。

- `site.config.json`の`year`で対象年度を指定します。その年の12月1〜25日以外の有効な記事は警告を出して掲載対象から除外します。
- メタデータ、実在する日付、HTTPS URL、PNG/PDFのシグネチャ、サイズ、UTF-8、記事ディレクトリ内のパスをビルド時に検証します。不正・欠損データではビルドが失敗します。
- 概要と本文は`@astrojs/markdown-remark`でGFM（見出し、強調、リスト、表、コードなど）をHTML化し、`rehype-sanitize`で危険なHTMLを除去します。これらはビルド時だけ動作します。
- 生のHTMLや埋め込みスクリプトは許可しません。Markdown中の画像は自動取得せず、HTTPSの画像はリンク、それ以外は代替テキストとして表示します。LaTeX数式の組版は追加していません。
- PDFは埋め込んだデータからダウンロードできます。HTMLのサイズは全記事・画像・PDFの合計に応じて増えます（バイナリはBase64で約4/3倍）。

## デプロイ

既存のVercel／Cloudflare Pagesなどの静的ホスティングで、次を指定してください。

| 設定 | 値 |
| --- | --- |
| プロジェクトのルート | `Front` |
| インストール | `npm ci` |
| ビルド | `npm run build` |
| 公開ディレクトリ | `dist` |

サーバーアダプターや実行時の環境変数は不要です。Botが記事をコミットしたら、連携済みホスティングのGit連携などで再ビルドしてください。開いているページへ新規投稿を取得する通信は行わないため、投稿反映後は再読み込みが必要です。公開日はブラウザで判定するので、同梱済み記事の公開のためだけの毎日のビルドは不要です。

## ファイル構成

- `src/components/Calendar.astro`、`Daytag.astro`: 2025年版のカレンダーを移植したコンポーネント。
- `src/components/ArticleCard.astro`: 3種類の記事形式の表示。
- `src/pages/index.astro`: ビルド時の読み込み、HTMLへの埋め込み、CSP。
- `src/calendar.mjs`、`src/app.js`: 日本時間での公開判定、日付選択、検索。
- `scripts/content.mjs`、`scripts/markdown.mjs`: ファイル検証とMarkdown変換。
- `tests/`: 公開日の境界、Bot形式、入力検証、Markdown、生成HTMLの検証。

カレンダーの移植元とMITライセンスは[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)を参照してください。
