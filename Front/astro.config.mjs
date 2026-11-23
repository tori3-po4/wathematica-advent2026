import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// 記事の読み込みはビルド時に完了させ、配信時にはHTML・JS・CSSだけで動作させる。
export default defineConfig({
  output: "static",
  // Astroの静的HTMLへReactの操作部分を組み込み、Tailwindのクラスをビルド時にCSSへ変換する。
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
  // スタイルはHTMLへ埋め込まず、同一サイトのCSSファイルとして配信する。
  build: { inlineStylesheets: "never" },
  // 開発用のUIをページへ挿入せず、表示と通信の確認をしやすくする。
  devToolbar: { enabled: false },
});
