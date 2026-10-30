import { type Nodes } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";

function readText(node: Nodes): string {
  if (node.type === "definition" || node.type === "html") {
    return "";
  }

  if ("value" in node) {
    return node.value;
  }

  if (node.type === "image" || node.type === "imageReference") {
    return node.alt ?? "";
  }

  if ("children" in node) {
    const separator = ["root", "blockquote", "list", "listItem", "table", "tableRow"].includes(
      node.type,
    )
      ? " "
      : "";

    return node.children.map(readText).join(separator);
  }

  return node.type === "break" ? " " : "";
}

export function markdownToPlainText(markdown: string): string {
  return readText(
    fromMarkdown(markdown, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] }),
  )
    .replaceAll(/\s+/gu, " ")
    .trim();
}
