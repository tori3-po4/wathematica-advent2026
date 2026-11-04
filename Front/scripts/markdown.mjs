import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import rehypeSanitize from "rehype-sanitize";

export function safeHttps(value) {
  if (typeof value !== "string" || /[\s\u0000-\u001f\u007f]/u.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function walk(node, visitor, parent = null) {
  visitor(node, parent);
  for (const child of node.children || []) walk(child, visitor, node);
}

// Convert images before Astro's image collector: neither builds nor readers fetch them.
function remarkOfflineImages() {
  return (tree) => walk(tree, (node, parent) => {
    if (node.type !== "image" && node.type !== "imageReference") return;
    const url = safeHttps(node.url);
    const replacement = url && parent?.type !== "link"
      ? { type: "link", url, children: [{ type: "text", value: `画像: ${node.alt || "画像を開く"}` }] }
      : { type: "text", value: `画像: ${node.alt || "画像"}` };
    const index = parent.children.indexOf(node);
    parent.children[index] = replacement;
  });
}

function rehypeOfflineContent() {
  return (tree, file) => {
    const prefix = file.data.astro.frontmatter.namespace;
    let heading = 0;
    walk(tree, (node) => {
      if (node.type !== "element") return;
      if (/^h[1-6]$/.test(node.tagName)) {
        node.tagName = `h${Math.min(6, Number(node.tagName[1]) + 3)}`;
        node.properties.id = `${prefix}-heading-${++heading}`;
      } else if (node.properties.id) {
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
          node.properties.href = `#${prefix}-${href.slice(1)}`;
        } else {
          delete node.properties.href;
        }
      }
    });
  };
}

const processor = createMarkdownProcessor({
  syntaxHighlight: false,
  smartypants: false,
  gfm: true,
  remarkPlugins: [remarkOfflineImages],
  remarkRehype: { allowDangerousHtml: false },
  rehypePlugins: [rehypeSanitize, rehypeOfflineContent],
});

export async function renderMarkdown(source, namespace = "article") {
  if (!/^[a-z0-9_-]+$/.test(namespace)) throw new Error("Invalid Markdown namespace");
  return (await (await processor).render(source, { frontmatter: { namespace } })).code;
}
