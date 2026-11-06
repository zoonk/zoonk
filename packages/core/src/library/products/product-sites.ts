import "server-only";
import { prisma } from "@zoonk/db";
import { type OfficeContentNode, parseOffice } from "officeparser";
import { fetchDocument } from "../sources/fetch-document";
import { toRegistrableDomain } from "./product-keys";

const LINK_TAG = /<link\b(?<attributes>[^>]*)>/giu;

const ATTRIBUTE =
  /(?<key>[\w:-]+)\s*=\s*(?:"(?<double>[^"]*)"|'(?<single>[^']*)'|(?<bare>[^\s"'>]+))/gu;

const SIZE = /^(?<width>\d+)x\d+$/iu;

const SVG = /\.svg(?:$|\?)/iu;

/** A scalable icon draws at any size, so it ranks above every bitmap. */
const SCALABLE = 10_000;

export type PageTags = {
  /** Absolute addresses of the links a visitor can follow, without their fragment. */
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

function collectLinks(nodes: readonly OfficeContentNode[] | undefined): string[] {
  return (nodes ?? []).flatMap((node) => [
    ...(node.metadata && "link" in node.metadata && typeof node.metadata.link === "string"
      ? [node.metadata.link]
      : []),
    ...collectLinks(node.children),
  ]);
}

function readAttributes(text: string): Map<string, string> {
  return new Map(
    [...text.matchAll(ATTRIBUTE)].map(({ groups }) => [
      groups?.key?.toLowerCase() ?? "",
      groups?.double ?? groups?.single ?? groups?.bare ?? "",
    ]),
  );
}

function rankIcon(attributes: Map<string, string>): number {
  const href = attributes.get("href") ?? "";

  if (attributes.get("type") === "image/svg+xml" || SVG.test(href)) {
    return SCALABLE;
  }

  const sizes = (attributes.get("sizes") ?? "").split(/\s+/u);
  return Math.max(0, ...sizes.map((size) => Number(SIZE.exec(size)?.groups?.width ?? 0)));
}

/**
 * The site's own icon: an apple-touch-icon, else its largest declared icon. Read from the raw tags,
 * since only a logo copy depends on it, never a site's identity.
 */
function pickIcon({ base, html }: { base: string; html: string }): string | null {
  const icons = [...html.matchAll(LINK_TAG)]
    .map(({ groups }) => readAttributes(groups?.attributes ?? ""))
    .map((attributes) => ({
      attributes,
      rels: (attributes.get("rel") ?? "").toLowerCase().split(/\s+/u),
    }));

  const touch = icons.find((icon) => icon.rels.includes("apple-touch-icon"));

  const [best] = icons
    .filter((icon) => icon.rels.includes("icon"))
    .toSorted((first, second) => rankIcon(second.attributes) - rankIcon(first.attributes));

  return toAbsoluteUrl({ base, href: (touch ?? best)?.attributes.get("href") });
}

/**
 * Links come from the same HTML parser that reads pages' text, which leaves out comments, scripts
 * and templates: what no visitor can follow never ties two sites.
 */
export async function readPageTags({
  base,
  bytes,
}: {
  base: string;
  bytes: Uint8Array;
}): Promise<PageTags> {
  const ast = await parseOffice(Buffer.from(bytes), { fileType: "html", ignoreComments: true });
  const shareImage: unknown = ast.metadata.nativeProperties?.["og:image"];

  const links = collectLinks(ast.content).flatMap((href) => toAbsoluteUrl({ base, href }) ?? []);

  return {
    iconUrl: pickIcon({ base, html: new TextDecoder().decode(bytes) }),
    imageUrl: typeof shareImage === "string" ? toAbsoluteUrl({ base, href: shareImage }) : null,
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
    tags: await readPageTags({ base: fetched.url, bytes: fetched.bytes }),
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
