import "server-only";
import { prisma } from "@zoonk/db";
import { fetchDocument } from "../sources/fetch-document";
import { toRegistrableDomain } from "./product-keys";

const INERT_START = /<!--|<(?<element>script|style|template|noscript)\b/giu;
const TEMPLATE_TAG = /<(?<closing>\/?)template\b[^>]*>/giu;

const TAG = /<(?<name>a|link|meta)\b(?<attributes>[^>]*)>/giu;

const ATTRIBUTE =
  /(?<key>[\w:-]+)\s*=\s*(?:"(?<double>[^"]*)"|'(?<single>[^']*)'|(?<bare>[^\s"'>]+))/gu;

const SIZE = /^(?<width>\d+)x\d+$/iu;
const SVG = /\.svg(?:$|\?)/iu;
const ENTITIES: Record<string, string> = { "&#39;": "'", "&amp;": "&", "&quot;": '"' };
const ENTITY = /&(?:amp|quot|#39);/gu;

/** A scalable icon draws at any size, so it ranks above every bitmap. */
const SCALABLE = 10_000;

type Tag = { attributes: Map<string, string>; name: string };

export type PageTags = {
  /** Absolute addresses of the page's links, without their fragment. */
  links: string[];
  iconUrl: string | null;
  imageUrl: string | null;
};

function readAttributes(text: string): Map<string, string> {
  return new Map(
    [...text.matchAll(ATTRIBUTE)].map(({ groups }) => [
      groups?.key?.toLowerCase() ?? "",
      (groups?.double ?? groups?.single ?? groups?.bare ?? "").replaceAll(
        ENTITY,
        (entity) => ENTITIES[entity] ?? entity,
      ),
    ]),
  );
}

/** Where a template ends, counting the templates nested in it; -1 when it never does. */
function findTemplateEnd({ html, start }: { html: string; start: number }): number {
  let depth = 0;

  for (const tag of html.slice(start).matchAll(TEMPLATE_TAG)) {
    depth += tag.groups?.closing ? -1 : 1;

    if (depth === 0) {
      return start + tag.index + tag[0].length;
    }
  }

  return -1;
}

/** Where a comment or raw-text element (a script, a style) ends; -1 when it never does. */
function findInertEnd({
  element,
  html,
  start,
}: {
  element: string | undefined;
  html: string;
  start: number;
}): number {
  if (!element) {
    const end = html.indexOf("-->", start + "<!--".length);
    return end === -1 ? -1 : end + "-->".length;
  }

  if (element.toLowerCase() === "template") {
    return findTemplateEnd({ html, start });
  }

  const closing = html.toLowerCase().indexOf(`</${element.toLowerCase()}`, start);
  const end = closing === -1 ? -1 : html.indexOf(">", closing);
  return end === -1 ? -1 : end + 1;
}

/**
 * Comments, scripts and templates aren't links a visitor follows, so they never tie two sites. One
 * left open hides the rest of the page, as a browser would.
 */
function removeInert(html: string): string {
  let visible = "";
  let index = 0;

  for (;;) {
    INERT_START.lastIndex = index;
    const match = INERT_START.exec(html);

    if (!match) {
      return visible + html.slice(index);
    }

    visible += html.slice(index, match.index);
    index = findInertEnd({ element: match.groups?.element, html, start: match.index });

    if (index === -1) {
      return visible;
    }
  }
}

function readTags(html: string): Tag[] {
  return [...removeInert(html).matchAll(TAG)].map(({ groups }) => ({
    attributes: readAttributes(groups?.attributes ?? ""),
    name: groups?.name?.toLowerCase() ?? "",
  }));
}

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

function hasRel(tag: Tag, rel: string): boolean {
  return (tag.attributes.get("rel") ?? "").toLowerCase().split(/\s+/u).includes(rel);
}

function rankIcon(tag: Tag): number {
  const href = tag.attributes.get("href") ?? "";

  if (tag.attributes.get("type") === "image/svg+xml" || SVG.test(href)) {
    return SCALABLE;
  }

  const sizes = (tag.attributes.get("sizes") ?? "").split(/\s+/u);
  return Math.max(0, ...sizes.map((size) => Number(SIZE.exec(size)?.groups?.width ?? 0)));
}

/** The site's own icon: an apple-touch-icon, else its largest declared icon. */
function pickIcon({ base, tags }: { base: string; tags: Tag[] }): string | null {
  const links = tags.filter((tag) => tag.name === "link");
  const touch = links.find((tag) => hasRel(tag, "apple-touch-icon"));

  const [best] = links
    .filter((tag) => hasRel(tag, "icon"))
    .toSorted((first, second) => rankIcon(second) - rankIcon(first));

  return toAbsoluteUrl({ base, href: (touch ?? best)?.attributes.get("href") });
}

function pickShareImage({ base, tags }: { base: string; tags: Tag[] }): string | null {
  const meta = tags.find(
    (tag) => tag.name === "meta" && tag.attributes.get("property")?.toLowerCase() === "og:image",
  );

  return toAbsoluteUrl({ base, href: meta?.attributes.get("content") });
}

/** Best effort over raw HTML: a page whose markup this misses only loses its links or media. */
export function readPageTags({ base, html }: { base: string; html: string }): PageTags {
  const tags = readTags(html);

  const links = tags
    .filter((tag) => tag.name === "a")
    .flatMap((tag) => toAbsoluteUrl({ base, href: tag.attributes.get("href") }) ?? []);

  return {
    iconUrl: pickIcon({ base, tags }),
    imageUrl: pickShareImage({ base, tags }),
    links: [...new Set(links)],
  };
}

type InspectedPage = { domain: string; tags: PageTags; url: string };

export type ProductSites = {
  brand: { domain: string; iconUrl: string | null; url: string };
  product: { domain: string; imageUrl: string | null; links: string[]; url: string };
};

function linksToDomain({ domain, page }: { domain: string; page: InspectedPage }): boolean {
  return page.tags.links.some((link) => toRegistrableDomain(link) === domain);
}

/**
 * Decision 4: one registrable domain, or each site links to the other. A product page linking to a
 * brand alone would let any third-party page claim the brand.
 */
export function isProductOfBrand({
  brand,
  product,
}: {
  brand: InspectedPage;
  product: InspectedPage;
}): boolean {
  return (
    brand.domain === product.domain ||
    (linksToDomain({ domain: brand.domain, page: product }) &&
      linksToDomain({ domain: product.domain, page: brand }))
  );
}

/** A site's root ("github.com/") would vouch for every page on it, so a link needs a path. */
function isUnderLink({ link, url }: { link: string; url: string }): boolean {
  const { origin, pathname } = new URL(link);
  const base = `${origin}${pathname.replace(/\/+$/u, "")}`;

  return pathname.replace(/\/+$/u, "") !== "" && (url === base || url.startsWith(`${base}/`));
}

/**
 * Docs and releases pages count on the brand's or the product's domain, or under an address the
 * product page links to, such as its code repository's releases.
 */
export function isOfficialPage({ sites, url }: { sites: ProductSites; url: string }): boolean {
  const domain = toRegistrableDomain(url);

  return (
    domain !== null &&
    (domain === sites.brand.domain ||
      domain === sites.product.domain ||
      sites.product.links.some((link) => isUnderLink({ link, url })))
  );
}

async function inspectPage(url: string): Promise<InspectedPage | null> {
  const fetched = await fetchDocument(url);
  const domain = toRegistrableDomain(fetched.url);

  if (!domain || !fetched.contentType.includes("html")) {
    return null;
  }

  const html = new TextDecoder().decode(fetched.bytes);
  return { domain, tags: readPageTags({ base: fetched.url, html }), url: fetched.url };
}

/**
 * Brand identity is the domain of the address the server fetched, never a model's word. Null when
 * either page isn't an HTML page on a registrable domain or the two sites aren't tied.
 */
export async function inspectProductSites({
  brandUrl,
  productUrl,
}: {
  brandUrl: string;
  productUrl: string;
}): Promise<ProductSites | null> {
  const [brand, product] = await Promise.all([inspectPage(brandUrl), inspectPage(productUrl)]);

  if (!brand || !product || !isProductOfBrand({ brand, product })) {
    return null;
  }

  return {
    brand: { domain: brand.domain, iconUrl: brand.tags.iconUrl, url: brand.url },
    product: {
      domain: product.domain,
      imageUrl: product.tags.imageUrl,
      links: product.tags.links,
      url: product.url,
    },
  };
}

/**
 * A saved product's sites: its brand's and product's domains, and its stored pages as the addresses
 * research verified, so a later page under one (a release under its releases page) counts too.
 */
export async function loadProductSites({
  brand,
  product,
}: {
  brand: { domain: string | null; website: string | null };
  product: { id: string; website: string };
}): Promise<ProductSites | null> {
  const productDomain = toRegistrableDomain(product.website);

  if (!brand.domain || !brand.website || !productDomain) {
    return null;
  }

  const sources = await prisma.source.findMany({
    select: { url: true },
    where: { productId: product.id },
  });

  return {
    brand: { domain: brand.domain, iconUrl: null, url: brand.website },
    product: {
      domain: productDomain,
      imageUrl: null,
      links: sources.flatMap((source) => source.url ?? []),
      url: product.website,
    },
  };
}
