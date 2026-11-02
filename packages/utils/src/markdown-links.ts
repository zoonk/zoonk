import { type Definition, type Nodes, type Root } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";

/** GFM autolinks these in plain text, and no escape stops it, so such words become inline code. */
const AUTOLINK_TEXT = /:\/\/|www\.|@/u;

type Rewrite = {
  definitions: ReadonlyMap<string, Definition>;
  isAllowed: (href: string) => boolean;
  kept: string[];
  removed: string[];
  source: string;
};

function getChildren(node: Nodes): readonly Nodes[] {
  return "children" in node ? node.children : [];
}

function getSpan(node: Nodes): { end: number; start: number } {
  return { end: node.position?.end.offset ?? 0, start: node.position?.start.offset ?? 0 };
}

const MARKDOWN_PUNCTUATION = /[!-/:-@[-`{-~]/gu;

/** Past this many rewrites the whole text becomes a code block rather than risk a link. */
const MAX_REWRITES = 16;

function readWords(node: Nodes): string {
  if (node.type === "text" || node.type === "inlineCode") {
    return node.value;
  }

  if (node.type === "image" || node.type === "imageReference") {
    return node.alt ?? "";
  }

  return getChildren(node)
    .map((child) => readWords(child))
    .join("");
}

function toCodeSpan(words: string): string {
  const longestTicks = Math.max(0, ...(words.match(/`+/gu) ?? []).map((ticks) => ticks.length));
  const fence = "`".repeat(longestTicks + 1);

  return `${fence} ${words} ${fence}`;
}

function spliceChildren({
  end,
  node,
  rewrite,
  start,
}: {
  end: number;
  node: Nodes;
  rewrite: Rewrite;
  start: number;
}): string {
  let text = "";
  let cursor = start;

  for (const child of getChildren(node)) {
    const span = getSpan(child);
    text += rewrite.source.slice(cursor, span.start) + rewriteNode(child, rewrite);
    cursor = span.end;
  }

  return text + rewrite.source.slice(cursor, end);
}

function rewriteLabel(node: Nodes, rewrite: Rewrite): string {
  const children = getChildren(node);
  const [first] = children;
  const last = children.at(-1);

  if (!first || !last) {
    return "";
  }

  return spliceChildren({ end: getSpan(last).end, node, rewrite, start: getSpan(first).start });
}

function rewriteLink({
  href,
  node,
  rewrite,
}: {
  href: string | null;
  node: Nodes;
  rewrite: Rewrite;
}): string {
  const label = rewriteLabel(node, rewrite);

  if (href !== null && rewrite.isAllowed(href)) {
    rewrite.kept.push(href);
    return `[${label}](${href})`;
  }

  rewrite.removed.push(href ?? "");

  return AUTOLINK_TEXT.test(readWords(node)) ? toCodeSpan(readWords(node)) : label;
}

function rewriteImage(alt: string, rewrite: Rewrite): string {
  rewrite.removed.push("image");

  return AUTOLINK_TEXT.test(alt)
    ? toCodeSpan(alt)
    : alt.replaceAll(MARKDOWN_PUNCTUATION, String.raw`\$&`);
}

function rewriteNode(node: Nodes, rewrite: Rewrite): string {
  if (node.type === "link") {
    return rewriteLink({ href: node.url, node, rewrite });
  }

  if (node.type === "linkReference") {
    const href = rewrite.definitions.get(node.identifier)?.url ?? null;
    return rewriteLink({ href, node, rewrite });
  }

  if (node.type === "image" || node.type === "imageReference") {
    return rewriteImage(node.alt ?? "", rewrite);
  }

  if (node.type === "definition" || node.type === "html") {
    rewrite.removed.push(node.type);
    return "";
  }

  return spliceChildren({ ...getSpan(node), node, rewrite });
}

function collectDefinitions(node: Nodes, found: Map<string, Definition>): Map<string, Definition> {
  if (node.type === "definition" && !found.has(node.identifier)) {
    found.set(node.identifier, node);
  }

  for (const child of getChildren(node)) {
    collectDefinitions(child, found);
  }

  return found;
}

function rewriteOnce({
  isAllowed,
  markdown,
}: {
  isAllowed: (href: string) => boolean;
  markdown: string;
}): Rewrite & { markdown: string } {
  const tree: Root = fromMarkdown(markdown, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });

  const rewrite: Rewrite = {
    definitions: collectDefinitions(tree, new Map()),
    isAllowed,
    kept: [],
    removed: [],
    source: markdown,
  };

  const text = spliceChildren({ end: markdown.length, node: tree, rewrite, start: 0 });

  return { ...rewrite, markdown: text };
}

function toCodeBlock(markdown: string): string {
  const longestFence = Math.max(2, ...(markdown.match(/`+/gu) ?? []).map((ticks) => ticks.length));
  const fence = "`".repeat(longestFence + 1);

  return `${fence}text\n${markdown}\n${fence}`;
}

/**
 * Every link `isAllowed` rejects becomes its label, images their escaped alt text, and raw HTML and
 * link definitions go; everything else stays as written. Removing a link can make a new one, so it
 * rereads until nothing changes and the result's only links are approved ones.
 */
export function keepAllowedMarkdownLinks({
  isAllowed,
  markdown,
}: {
  isAllowed: (href: string) => boolean;
  markdown: string;
}): { kept: string[]; markdown: string; removed: string[] } {
  const removed: string[] = [];
  let text = markdown;

  for (let rewrites = 0; rewrites < MAX_REWRITES; rewrites += 1) {
    const reading = rewriteOnce({ isAllowed, markdown: text });
    removed.push(...reading.removed);

    if (reading.markdown === text) {
      return { kept: reading.kept, markdown: text, removed };
    }

    text = reading.markdown;
  }

  return { kept: [], markdown: toCodeBlock(markdown), removed: [...removed, "unsettled"] };
}
