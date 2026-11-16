import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import rehypeSanitize from "rehype-sanitize";

/** HTTPS・資格情報なしのURLを正規化して返す。許可できない入力はnullにする。 */
export function safeHttps(value) {
  // URLコンストラクターが補正・除去する空白や制御文字も、入力段階で明示的に拒否する。
  if (typeof value !== "string" || /[\s\u0000-\u001f\u007f]/u.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

/** Markdown ASTとHTML ASTに共通するchildrenをたどり、必要なら親の要素も書き換えられるようにする。 */
function walk(node, visitor, parent = null) {
  visitor(node, parent);
  for (const child of node.children || []) walk(child, visitor, node);
}

// Markdown ASTの段階で画像をリンクか文字へ変え、Astroの画像収集より先に処理する。
// これによりビルド時も閲覧時も画像を自動取得せず、HTTPS画像だけ読者の操作で開ける。
function remarkOfflineImages() {
  return (tree) => walk(tree, (node, parent) => {
    if (node.type !== "image" && node.type !== "imageReference") return;
    const url = safeHttps(node.url);
    // リンク内の画像はリンクを入れ子にできないため文字にする。参照形式の画像も文字扱いになる。
    const replacement = url && parent?.type !== "link"
      ? { type: "link", url, children: [{ type: "text", value: `画像: ${node.alt || "画像を開く"}` }] }
      : { type: "text", value: `画像: ${node.alt || "画像"}` };
    const index = parent.children.indexOf(node);
    parent.children[index] = replacement;
  });
}

// サニタイズ済みHTMLを記事カード内へ収め、記事間のID衝突と意図しないリンク移動を防ぐ。
function rehypeOfflineContent() {
  return (tree, file) => {
    const prefix = file.data.astro.frontmatter.namespace;
    let heading = 0;
    walk(tree, (node) => {
      if (node.type !== "element") return;
      if (/^h[1-6]$/.test(node.tagName)) {
        // ページh1 → セクションh2 → 記事h3の下に、Markdownの見出しを配置する。
        node.tagName = `h${Math.min(6, Number(node.tagName[1]) + 3)}`;
        node.properties.id = `${prefix}-heading-${++heading}`;
      } else if (node.properties.id) {
        // 脚注など、サニタイザーが残したIDも記事・概要/本文ごとの名前空間に閉じ込める。
        node.properties.id = `${prefix}-${node.properties.id}`;
      }
      if (node.tagName === "a") {
        const href = node.properties.href;
        const url = safeHttps(href);
        if (url) {
          node.properties.href = url;
          node.properties.target = "_blank";
          node.properties.rel = ["noopener", "noreferrer"];
        } else if (typeof href === "string" && href.startsWith("#user-content-")) {
          // GFMの脚注などが参照する、サニタイズ後の内部IDにも同じ接頭辞を付ける。
          node.properties.href = `#${prefix}-${href.slice(1)}`;
        } else {
          // 相対URLや許可外スキームへの移動を無効化し、リンクの文面だけ残す。
          delete node.properties.href;
        }
      }
    });
  };
}

// 記事ごとに初期化し直さず、同じ設定のプロセッサーを共有する。
// Markdown → 画像の置換 → HTML化 → サニタイズ → 見出し・リンクの調整、の順序を保つ。
const processor = createMarkdownProcessor({
  syntaxHighlight: false,
  smartypants: false,
  gfm: true,
  remarkPlugins: [remarkOfflineImages],
  remarkRehype: { allowDangerousHtml: false },
  rehypePlugins: [rehypeSanitize, rehypeOfflineContent],
});

/** ReactのdangerouslySetInnerHTMLへ渡せるHTMLを生成する、ビルド時専用の変換入口。 */
export async function renderMarkdown(source, namespace = "article") {
  // 名前空間は生成HTMLのIDになるため、記事IDと同じ安全な文字の範囲に限定する。
  if (!/^[a-z0-9_-]+$/.test(namespace)) throw new Error("Invalid Markdown namespace");
  return (await (await processor).render(source, { frontmatter: { namespace } })).code;
}
