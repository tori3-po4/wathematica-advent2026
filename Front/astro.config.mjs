import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// 記事の読み込みはビルド時に完了させ、配信時にはHTML・JS・CSSだけで動作させる。
export default defineConfig({
  output: "static",
  // Astroの静的HTMLへReactの操作部分を組み込み、Tailwindのクラスをビルド時にCSSへ変換する。
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
  // Astro標準の構文強調も無効にし、CSPと競合するインラインスタイルを生成しない。
  markdown: { syntaxHighlight: false },
  // スタイルは同一サイトのCSSとして配信する。インライン処理の許可は下のCSPに集約する。
  build: { inlineStylesheets: "never" },
  security: {
    csp: {
      // 初期値では通信・埋め込みを拒否し、検証済みの埋め込み画像(data:)だけ個別に許可する。
      // フォントは見出し用に同梱したNoto Serif JPだけを同一サイトから読み込む。
      // 記事をすでに同梱しているため、fetch等の追加通信(connect-src)は必要ない。
      directives: [
        "default-src 'none'", "img-src data:", "connect-src 'none'",
        "font-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'none'",
      ],
      // JS・CSSは同一サイトから読み込む。Astro自身のインラインコードは自動生成ハッシュで許可する。
      scriptDirective: { resources: ["'self'"] },
      styleDirective: { resources: ["'self'"] },
    },
  },
  // 開発用のUIをページへ挿入せず、表示と通信の確認をしやすくする。
  devToolbar: { enabled: false },
});
