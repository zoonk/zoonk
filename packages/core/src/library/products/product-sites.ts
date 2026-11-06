import "server-only";
import { prisma } from "@zoonk/db";
import { type DefaultTreeAdapterMap, parse } from "parse5";
import { fetchDocument } from "../sources/fetch-document";
import { toRegistrableDomain } from "./product-keys";

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
    elements.push(...children);
    pending.push(...children.toReversed());
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

  return {
    domain,
    tags: readPageTags({ html: new TextDecoder().decode(fetched.bytes), url: fetched.url }),
    url: fetched.url,
  };
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
