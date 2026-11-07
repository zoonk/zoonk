import { type DefaultTreeAdapterMap, parse } from "parse5";

const SIZE = /^(?<width>\d+)x\d+$/iu;
const SVG = /\.svg(?:$|\?)/iu;

/** A scalable icon draws at any size, so it ranks above every bitmap. */
const SCALABLE = 10_000;

type Element = DefaultTreeAdapterMap["element"];

export type PageTags = {
  /** Absolute addresses of the page's links, without their fragment. */
  links: string[];
  iconUrl: string | null;
  imageUrl: string | null;
};

function toAbsoluteUrl({ base, href }: { base: string; href: string | undefined }): string | null {
  if (!href || !URL.canParse(href.trim(), base)) {
    return null;
  }

  const url = new URL(href.trim(), base);

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return null;
  }

  url.hash = "";
  return url.toString();
}

/**
 * The document's elements in order. A template's content and a script's text aren't child elements
 * in the parsed tree, so what no visitor can follow is never listed.
 */
function listElements(html: string): Element[] {
  const elements: Element[] = [];
  const pending: DefaultTreeAdapterMap["parentNode"][] = [parse(html)];

  for (let node = pending.pop(); node; node = pending.pop()) {
    const children = node.childNodes.filter((child): child is Element => "tagName" in child);
    // One at a time: spreading a directory's 100,000 siblings into `push` overflows the stack.
    for (const child of children.toReversed()) {
      pending.push(child);
    }

    for (const child of children) {
      elements.push(child);
    }
  }

  return elements;
}

function readAttribute(element: Element, name: string): string | undefined {
  return element.attrs.find((attribute) => attribute.name === name)?.value;
}

function hasToken(element: Element, { name, token }: { name: string; token: string }): boolean {
  return (readAttribute(element, name) ?? "").toLowerCase().split(/\s+/u).includes(token);
}

function rankIcon(element: Element): number {
  const href = readAttribute(element, "href") ?? "";

  if (readAttribute(element, "type") === "image/svg+xml" || SVG.test(href)) {
    return SCALABLE;
  }

  const sizes = (readAttribute(element, "sizes") ?? "").split(/\s+/u);
  return Math.max(0, ...sizes.map((size) => Number(SIZE.exec(size)?.groups?.width ?? 0)));
}

/** The site's own icon: an apple-touch-icon, else its largest declared icon. */
function pickIcon(links: Element[]): Element | undefined {
  const touch = links.find((link) => hasToken(link, { name: "rel", token: "apple-touch-icon" }));

  const [best] = links
    .filter((link) => hasToken(link, { name: "rel", token: "icon" }))
    .toSorted((first, second) => rankIcon(second) - rankIcon(first));

  return touch ?? best;
}

/** From the parsed document, as a browser builds it, so a link it wouldn't show never counts. */
export function readPageTags({ html, url }: { html: string; url: string }): PageTags {
  const elements = listElements(html);
  const byName = (name: string) => elements.filter((element) => element.tagName === name);

  const baseHref = byName("base")
    .map((element) => readAttribute(element, "href"))
    .find(Boolean);

  const base = toAbsoluteUrl({ base: url, href: baseHref }) ?? url;
  const resolve = (href: string | undefined) => toAbsoluteUrl({ base, href });

  const shareImage = byName("meta").find(
    (meta) => readAttribute(meta, "property")?.toLowerCase() === "og:image",
  );

  const links = byName("a").flatMap((anchor) => resolve(readAttribute(anchor, "href")) ?? []);
  const icon = pickIcon(byName("link"));

  return {
    iconUrl: icon ? resolve(readAttribute(icon, "href")) : null,
    imageUrl: shareImage ? resolve(readAttribute(shareImage, "content")) : null,
    links: [...new Set(links)],
  };
}

/** Byte-order marks as their bytes read in windows-1252, the prescan's decoding. */
const BYTE_ORDER_MARKS = [
  { label: "utf8", marks: "\u00EF\u00BB\u00BF" },
  { label: "utf-16le", marks: "\u00FF\u00FE" },
  { label: "utf-16be", marks: "\u00FE\u00FF" },
];

const META_CHARSET = /<meta\b[^>]*charset\s*=\s*["']?\s*(?<charset>[\w.:-]+)/iu;
const PRESCAN_BYTES = 1024;

/**
 * As a browser decodes a page: its byte-order mark, else the charset its `<meta>` declares in the
 * first kilobyte, else UTF-8. A declared UTF-16 can't be, since the bytes read as ASCII.
 */
export function decodeHtml(bytes: Uint8Array): string {
  const head = new TextDecoder("windows-1252").decode(bytes.subarray(0, PRESCAN_BYTES));
  const bom = BYTE_ORDER_MARKS.find(({ marks }) => head.startsWith(marks));
  const declared = META_CHARSET.exec(head)?.groups?.charset?.toLowerCase();
  const label = bom?.label ?? (declared?.startsWith("utf-16") ? "utf8" : declared) ?? "utf8";

  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return new TextDecoder().decode(bytes);
  }
}
