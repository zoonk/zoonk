/**
 * KaTeX draws `\boxed`, `\cancel` and the like as `<menclose>`, which Chromium leaves undrawn (it isn't
 * in MathML Core) while Firefox and Safari draw it their own way. As an `<mrow>` that keeps its
 * `notation`, every browser leaves it to `@zoonk/ui`'s math stylesheet, which draws it the same way.
 */
export function enclosuresAsRows(markup: string): string {
  return markup.replaceAll("<menclose", "<mrow").replaceAll("</menclose>", "</mrow>");
}

type HastNode = { children?: HastNode[]; tagName?: string; type: string };

function renameEnclosures(node: HastNode): void {
  if (node.type === "element" && node.tagName === "menclose") {
    node.tagName = "mrow";
  }

  node.children?.forEach(renameEnclosures);
}

export function rehypeEnclosuresAsRows() {
  return renameEnclosures;
}
