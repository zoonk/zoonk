import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
// oxlint-disable-next-line import/consistent-type-specifier-style -- `mdast` is types only: Node's type stripping keeps an import of inline type specifiers, which then fails to load.
import type { Image, Nodes, Paragraph, Root, RootContent } from "mdast";

/**
 * The one heading device pictures go under, so whoever reads the PR sees nothing measured their
 * layout: a picture taken from a simulator or an emulator, which no capture reads.
 */
export const DEVICE_HEADING = "On a device (layout not measured)";

export type DevicePicture = { caption: string; path: string };

/** Every other way a body can show media, taken out in turn so each shows up once. */
const OTHER_MEDIA = [
  /<(?:audio|img|picture|source|video)\b[^>]*>/giu,
  /!\[[^\]]*\](?:\[[^\]]*\]|\([^)]*\))?/gu,
  /^ {0,3}\[[^\]]+\]:\s*\S+/gmu,
  /\S+\.(?:avif|gif|jpe?g|mov|mp4|png|svg|webm|webp)\b/giu,
];

const PLAIN_LINE = `write it as a plain image line under "## ${DEVICE_HEADING}", its caption under it`;

/** What a reader sees of a node: HTML and comments show nothing the check can count on. */
function visibleText(node: Nodes): string {
  if (node.type === "html" || node.type === "image" || node.type === "imageReference") {
    return "";
  }

  if ("value" in node) {
    return node.value;
  }

  if ("children" in node) {
    return node.children.map((child) => visibleText(child)).join("");
  }

  return node.type === "break" ? " " : "";
}

function images(node: Nodes): Image[] {
  if (node.type === "image") {
    return [node];
  }

  return "children" in node ? node.children.flatMap((child) => images(child)) : [];
}

function plain(text: string): string {
  return text.replaceAll(/\s+/gu, " ").trim();
}

/**
 * Each image of a plain image line, with its caption: the visible words after it in its paragraph,
 * up to the next image, or else the next block's visible words.
 */
function captioned(paragraph: Paragraph, next: RootContent | undefined) {
  const following = plain(next ? visibleText(next) : "");

  return paragraph.children.flatMap((child, index) => {
    if (child.type !== "image") {
      return [];
    }

    const after = paragraph.children.slice(index + 1);
    const until = after.findIndex((other) => other.type === "image");

    const own = plain(
      (until === -1 ? after : after.slice(0, until)).map((node) => visibleText(node)).join(""),
    );

    return [{ caption: own || following, image: child }];
  });
}

type Placed = { onDevice: DevicePicture[]; outside: Image[]; unclear: string[] };

/**
 * Sorts the body's top-level blocks by the rendered heading they sit under. The device section is
 * a level-2 heading with exactly those words, to the next heading of level 1 or 2; a picture there
 * must be a plain image line outside any `<details>`, or the check can't tell what a reader sees.
 */
function place(root: Root): Placed {
  const placed: Placed = { onDevice: [], outside: [], unclear: [] };
  let inSection = false;
  let inDetails = false;

  for (const [index, node] of root.children.entries()) {
    if (node.type === "heading" && node.depth <= 2) {
      inSection = node.depth === 2 && plain(visibleText(node)) === DEVICE_HEADING;
      inDetails = false;
    } else if (!inSection) {
      placed.outside.push(...images(node));
    } else if (node.type === "html") {
      // Whatever a `<details>` holds is folded away until it's opened.
      const value = node.value.toLowerCase();
      const opened = value.lastIndexOf("<details");
      const closed = value.lastIndexOf("</details");
      inDetails = opened > closed || (inDetails && closed === -1);
    } else if (node.type === "paragraph" && !inDetails) {
      for (const { caption, image } of captioned(node, root.children[index + 1])) {
        placed.onDevice.push({ caption, path: image.url });
      }
    } else {
      placed.unclear.push(...images(node).map((image) => `${image.url}: ${PLAIN_LINE}`));
    }
  }

  return placed;
}

/**
 * The pictures a PR body shows, read from its rendered structure. `pictures` are those outside the
 * device heading, once each; `onDevice` every occurrence under it with its caption; `unsupported`
 * media written any other way, or placed where the check can't tell what a reader sees, so it
 * fails instead of going unchecked.
 */
export function bodyMedia(markdown: string): {
  onDevice: DevicePicture[];
  pictures: string[];
  unsupported: string[];
} {
  const root = fromMarkdown(markdown, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });

  const { onDevice, outside, unclear } = place(root);
  const all = images(root);

  // The one form the check reads: `![description](path "optional title")`, the path unspaced.
  const spaced = new Set(all.filter((image) => /\s/u.test(image.url) || !image.url));
  const read = all.filter((image) => !spaced.has(image));

  const rest = read.reduceRight(
    (text, image) =>
      text.slice(0, image.position?.start.offset ?? 0) +
      " ".repeat((image.position?.end.offset ?? 0) - (image.position?.start.offset ?? 0)) +
      text.slice(image.position?.end.offset ?? 0),
    markdown,
  );

  const { found } = OTHER_MEDIA.reduce(
    ({ found: earlier, rest: left }, pattern) => ({
      found: [...earlier, ...[...left.matchAll(pattern)].map((match) => match[0].trim())],
      rest: left.replaceAll(pattern, " "),
    }),
    { found: new Array<string>(), rest },
  );

  return {
    onDevice: onDevice.filter(({ path }) => !/\s/u.test(path) && path),
    pictures: [...new Set(outside.filter((image) => !spaced.has(image)).map((image) => image.url))],
    unsupported: [...new Set([...found, ...unclear])],
  };
}
