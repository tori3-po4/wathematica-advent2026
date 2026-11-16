# Wathematica Advent Calendar — Front

Astroで静的生成し、Reactコンポーネントで操作するアドベントカレンダーです。Botが保存する
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
npm run check
npm test
npm run preview
```

`npm run build`で`dist/index.html`と`dist/_astro/`のJavaScript・CSSが生成されます。
画像・PDFはHTMLに埋め込みます。`dist/`全体を配信してください。
ローカルでは`npm run preview`のURLで確認します。HTMLを直接開く`file://`での利用は対象外です。
`npm test`には生成物の検証が含まれるため、先にビルドしてください。
依存関係のインストール時のnpm監査は無効にしていません。
公開直後の依存を避けるため、`.npmrc`で`min-release-age=3`（3日間）を設定しています。
依存の追加・更新には、この設定に対応したnpmを使用してください（確認済み: npm 11.20.0）。

ブラウザ回帰テストは一時ディレクトリにテスト用の記事を生成して実行します。
実際の`content/`や`dist/`は変更しません。

```sh
npx playwright install chromium    # 初回のみ
npm run test:browser
```

インストール済みのGoogle Chromeを使う場合は、ブラウザの追加インストールなしで
`PLAYWRIGHT_CHANNEL=chrome npm run test:browser`を実行できます。

## 通信と公開日の扱い

- 初回表示時に同じサイトからJavaScript・CSSを取得します。著者アイコンとPDFはHTMLに埋め込み、表示・ダウンロード時の追加通信は発生しません。
- 記事メタデータと変換済みMarkdownはビルド時にReactのpropsとしてHTMLへ格納します。検索・日付選択・Markdown本文の展開で記事を取得するAPI通信は発生しません。
- 外部フォント、CDN、分析スクリプト、API、認証、データベースを使用しません。
- 本番HTMLのContent Security PolicyはAstroの`security.csp`で生成します。同じサイトのJavaScript・CSSと`data:`の埋め込み画像を許可し、Astroのインライン処理は自動生成するハッシュで許可します。`connect-src 'none'`でfetch等の通信を制限します。
- 日付は端末時計を日本時間（UTC+9）に変換し、各日0:00から表示します。ページを開いたままの日付変更と、タブへ戻った際の再判定にも対応します。NTPは使用しません。
- 12月25日以降や翌年も公開済み記事を閲覧できます。
- 外部記事やMarkdown内のHTTPSリンクは、読者がクリックした場合だけ別タブで開きます。移動先への通信は発生します。
- 開発時の`npm run dev`にはAstro/Viteの開発用通信があります。本番の通信やCSPの確認には`npm run build`後の`npm run preview`を使用してください。ホスティング側でも分析タグ等を自動挿入しない設定にしてください。

**公開日による表示制御は秘密保持の仕組みではありません。** 未公開の記事・画像・PDFも生成HTMLに含まれるため、ソース閲覧や端末時計の変更で読むことができます。厳密な事前非公開が必要な場合は、公開前の本文を配布せず、公開日に再ビルドする運用が別途必要です。

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
- メタデータはZodスキーマで必須項目・型・文字数・実在する日付・HTTPS URL・記事形式を検証します。未定義の項目もエラーになります。PNG/PDFのシグネチャ、サイズ、UTF-8、記事ディレクトリ内のパスはファイル読み込み時に検証し、不正・欠損データではビルドが失敗します。
- 概要と本文は`@astrojs/markdown-remark`でGFM（見出し、強調、リスト、表、コードなど）をHTML化し、`rehype-sanitize`で危険なHTMLを除去します。これらはビルド時だけ動作します。
- 生のHTMLや埋め込みスクリプトは許可しません。Markdown中の画像は自動取得せず、HTTPSの画像はリンク、それ以外は代替テキストとして表示します。LaTeX数式の組版は追加していません。
- 検証済みのPNGとPDFはBase64化してHTMLに埋め込み、PDFは埋め込みデータからダウンロードできます。HTMLのサイズは全記事・画像・PDFの合計に応じて増えます（バイナリはBase64で約4/3倍）。元の`article.json`やMarkdownファイル自体は配信しません。

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

- `src/components/AdventCalendar.tsx`: 日付・検索条件のstate、URLハッシュとの連携。
- `src/components/Calendar.tsx`、`DayTag.tsx`: カレンダーと日付ボタン。
- `src/components/ArticleList.tsx`、`ArticleCard.tsx`: 検索UI、記事一覧、3種類の記事形式の表示。
- `src/hooks/useCalendarDate.ts`: 端末時計の日付監視。初回描画後に公開日を判定。
- `src/calendar.mjs`: 日本時間での公開判定・絞り込みの純粋関数。
- `src/pages/index.astro`: ビルド時の記事読み込みとReactへの受け渡し、ページ全体のHTML。
- `astro.config.mjs`: React連携、Tailwind CSSのViteプラグイン、静的出力、CSP。
- `src/styles.css`: Tailwind CSSの読み込み。クラスの検出対象は`src/`。
- `scripts/article-schema.mjs`: 記事メタデータのZodスキーマ。
- `scripts/content.mjs`、`scripts/markdown.mjs`: ファイル検証とMarkdown変換。
- `tests/`: 公開日の境界、Bot形式、入力検証、Markdown、生成HTML、Reactのブラウザ操作の検証。

カレンダーの移植元とMITライセンスは[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)を参照してください。

## スタイリング

Tailwind CSS v4のユーティリティを各Astro／Reactコンポーネントの`class`／`className`に記述します。
ページ共通のフォント・リンク色・フォーカス表示・`hidden`属性の扱いは`src/pages/index.astro`、
Markdown内の見出し・表・コードなどは`ArticleCard.tsx`の`proseClasses`で管理します。
`AdventCalendar.tsx`は表示要素を持たず、状態管理と子コンポーネントの組み立てを担当します。

既存のフォーム部品・見出し・Markdownのブラウザ標準スタイルを維持するため、
[Preflight](https://tailwindcss.com/docs/preflight#disabling-preflight)は読み込んでいません。
`styles.css`にコンポーネント用のCSSルールを追加する必要はありません。
`day-tag`や`prose`など一部のクラス名は既存テストのセレクターとして残しています。
