import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
// oxlint-disable-next-line import/consistent-type-specifier-style -- `mdast` is types only: Node's type stripping keeps an import of inline type specifiers, which then fails to load.
import type { Image, Nodes } from "mdast";

/** An image as the body writes it: its link, and where its syntax starts and ends in the body. */
export type BodyImage = { end: number; link: string; start: number };

/** Every other way a body can show media, taken out in turn so each shows up once. */
const OTHER_MEDIA = [
  /<(?:audio|img|picture|source|video)\b[^>]*>/giu,
  /!\[[^\]]*\](?:\[[^\]]*\]|\([^)]*\))?/gu,
  /^ {0,3}\[[^\]]+\]:\s*\S+/gmu,
  /\S+\.(?:avif|gif|jpe?g|mov|mp4|png|svg|webm|webp)\b/giu,
];

function images(node: Nodes): Image[] {
  if (node.type === "image") {
    return [node];
  }

  return "children" in node ? node.children.flatMap((child) => images(child)) : [];
}

/** Code shows its text as written, so a file name in it is never media. */
function code(node: Nodes): { end: number; start: number }[] {
  if (node.type === "code" || node.type === "inlineCode") {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    return start === undefined || end === undefined ? [] : [{ end, start }];
  }

  return "children" in node ? node.children.flatMap((child) => code(child)) : [];
}

/**
 * Every image a PR body shows, wherever it's nested (in a link, emphasis, a table, a list, a
 * quote), in order, each occurrence apart. `unsupported` holds media written any other way, a path
 * with spaces included, so it fails instead of going unchecked.
 */
export function bodyMedia(markdown: string): { images: BodyImage[]; unsupported: string[] } {
  const root = fromMarkdown(markdown, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });

  const found = images(root).flatMap((image) => {
    const start = image.position?.start.offset;
    const end = image.position?.end.offset;
    return start === undefined || end === undefined ? [] : [{ end, link: image.url, start }];
  });

  // The one form the check reads: `![description](path "optional title")`, the path unspaced.
  const read = found.filter(({ link }) => link && !/\s/u.test(link));

  const rest = [...read, ...code(root)].reduce(
    (text, { end, start }) => text.slice(0, start) + " ".repeat(end - start) + text.slice(end),
    markdown,
  );

  const literalPunctuation = /\\[!-/:-@[-`{-~]/gu;

  const { other } = OTHER_MEDIA.reduce(
    ({ other: earlier, rest: left }, pattern) => ({
      other: [...earlier, ...[...left.matchAll(pattern)].map((match) => match[0].trim())],
      rest: left.replaceAll(pattern, " "),
    }),
    { other: new Array<string>(), rest: rest.replaceAll(literalPunctuation, " ") },
  );

  return { images: read, unsupported: [...new Set(other)] };
}
