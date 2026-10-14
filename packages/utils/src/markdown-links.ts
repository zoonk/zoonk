import { type Definition, type Nodes, type Root } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";

/**
 * What GFM reads as a link in plain text, after decoding it: a scheme's `://`, `www.` or an email
 * address. No escape stops it, so words a removed link leaves that hold one become inline code.
 */
const AUTOLINK_TEXT = /:\/\/|www\.|@/u;

type Rewrite = {
  definitions: ReadonlyMap<string, Definition>;
  isAllowed: (href: string) => boolean;
  kept: string[];
  removed: string[];
  source: string;
};

/** A node's children; none for a leaf. */
function getChildren(node: Nodes): readonly Nodes[] {
  return "children" in node ? node.children : [];
}

function getSpan(node: Nodes): { end: number; start: number } {
  return { end: node.position?.end.offset ?? 0, start: node.position?.start.offset ?? 0 };
}

/** ASCII punctuation, which a backslash makes read as itself in Markdown. */
const MARKDOWN_PUNCTUATION = /[!-/:-@[-`{-~]/gu;

/**
 * A rewrite that keeps changing the text this many times holds links inside links inside links:
 * past it, the whole answer reads as plain text (see `toCodeBlock`) rather than risk a link.
 */
const MAX_REWRITES = 16;

/** A node's words as a reader sees them: escapes and character references decoded. */
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

/** Words as inline code, which is never a link; its fence outlasts any backticks in them. */
function toCodeSpan(words: string): string {
  const longestTicks = Math.max(0, ...(words.match(/`+/gu) ?? []).map((ticks) => ticks.length));
  const fence = "`".repeat(longestTicks + 1);

  return `${fence} ${words} ${fence}`;
}

/** The source between `start` and `end`, with each child in it rewritten in place. */
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

/** What a link shows: its label's source, rewritten, from its first child to its last. */
function rewriteLabel(node: Nodes, rewrite: Rewrite): string {
  const children = getChildren(node);
  const [first] = children;
  const last = children.at(-1);

  if (!first || !last) {
    return "";
  }

  return spliceChildren({ end: getSpan(last).end, node, rewrite, start: getSpan(first).start });
}

/** A link stays a link, inline, only to an allowed destination; otherwise it's its label. */
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

  // Words that hold an address read as a link again once decoded, whatever their spelling.
  return AUTOLINK_TEXT.test(readWords(node)) ? toCodeSpan(readWords(node)) : label;
}

/** An image's alt text as words: escaped, so nothing in it reads as Markdown (a link, a cell). */
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

/** One rewrite of a text, read as GFM reads it (see `keepAllowedMarkdownLinks`). */
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

/** The whole text as a code block: its words, none of them a link. */
function toCodeBlock(markdown: string): string {
  const longestFence = Math.max(2, ...(markdown.match(/`+/gu) ?? []).map((ticks) => ticks.length));
  const fence = "`".repeat(longestFence + 1);

  return `${fence}text\n${markdown}\n${fence}`;
}

/**
 * A Markdown text with only the links `isAllowed` approves, read as GFM reads it: every inline,
 * reference, autolink and bare-URL link to anywhere else becomes its label (as inline code when
 * its words hold an address, which would read as a link again); images become their alt text,
 * escaped; raw HTML and link definitions go. An allowed link stays, written inline. Everything
 * else is left exactly as written (math and code included), since only those spans change.
 *
 * Removing a link can make one out of what's left (a link inside a link's label, a tag between
 * `]` and `(`), so the text is read again until a reading changes nothing: what it returns is
 * exactly what its last reading checked, so its only links are approved ones. Returns the text
 * with the links it kept and what it removed (destinations, `image`, `html`, `definition`).
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
