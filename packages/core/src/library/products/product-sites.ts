import "server-only";
import { prisma } from "@zoonk/db";
import { fetchDocument } from "../sources/fetch-document";
import { type PageTags, decodeHtml, readPageTags } from "./page-tags";
import { toNameKey, toRegistrableDomain } from "./product-keys";

type InspectedPage = { domain: string; tags: PageTags; url: string };

export type ProductSites = {
  brand: { domain: string; iconUrl: string | null; url: string };
  product: { domain: string; imageUrl: string | null; links: string[]; url: string };
};

const TRAILING_SLASHES = /\/+$/u;
const WWW = /^www\./u;
/** What a code host's maker publishes, on GitHub's and GitLab's paths alike. */
const RELEASES_PATH = /^(?:\/-)?\/(?:releases|tags)(?:\/|$)/u;
const RELEASES_PAGE = /\/(?:releases|tags)$/u;
/** Where anyone may write on a code host, even when the product page links straight to it. */
const COLLABORATION_PATH = /\/(?:issues|discussions|pulls?|merge_requests|wikis?)(?:\/|$)/u;

function toPath(url: string): string {
  return new URL(url).pathname.replace(TRAILING_SLASHES, "");
}

function toHost(url: string): string {
  return new URL(url).hostname.replace(WWW, "");
}

/** The path after `base`'s on the same host ("" for `base` itself); null when `url` isn't under it. */
function readPathUnder({ base, url }: { base: string; url: string }): string | null {
  const [basePath, path] = [toPath(base), toPath(url)];

  if (toHost(base) !== toHost(url)) {
    return null;
  }

  return path === basePath || path.startsWith(`${basePath}/`) ? path.slice(basePath.length) : null;
}

/**
 * A homepage's site is its whole registrable domain. A page with a path, such as a repository on a
 * code host, speaks only for itself and the pages under it: the rest of that host is other people's.
 */
function isOnProductSite({ productUrl, url }: { productUrl: string; url: string }): boolean {
  return toPath(productUrl) === ""
    ? toRegistrableDomain(url) === toRegistrableDomain(productUrl)
    : readPathUnder({ base: productUrl, url }) !== null;
}

function linksToDomain({ domain, page }: { domain: string; page: InspectedPage }): boolean {
  return page.tags.links.some((link) => toRegistrableDomain(link) === domain);
}

function linksToProduct({ page, product }: { page: InspectedPage; product: InspectedPage }) {
  return page.tags.links.some((link) => isOnProductSite({ productUrl: product.url, url: link }));
}

/** Enough for a homepage's menu entry and a footer link about the product. */
const MAX_PRODUCT_LINKS = 3;

/**
 * The brand links to the product's site from its homepage, or from one of its own pages about the
 * product (an address carrying the product's name) one hop away, as many brands do.
 */
async function vouchesFor({
  brand,
  product,
  productName,
}: {
  brand: InspectedPage;
  product: InspectedPage;
  productName: string;
}): Promise<boolean> {
  if (linksToProduct({ page: brand, product })) {
    return true;
  }

  const nameKey = toNameKey(productName);

  const pages = brand.tags.links
    .filter(
      (link) =>
        link !== brand.url &&
        toRegistrableDomain(link) === brand.domain &&
        nameKey !== "" &&
        toNameKey(new URL(link).pathname).includes(nameKey),
    )
    .slice(0, MAX_PRODUCT_LINKS);

  const visited = await Promise.allSettled(pages.map((url) => inspectPage(url)));

  return visited.some(
    (result) =>
      result.status === "fulfilled" &&
      result.value?.domain === brand.domain &&
      linksToProduct({ page: result.value, product }),
  );
}

/**
 * Decision 4: one registrable domain, or each site links to the other. A product page linking to a
 * brand alone would let any third-party page claim the brand.
 */
async function isProductOfBrand({
  brand,
  product,
  productName,
}: {
  brand: InspectedPage;
  product: InspectedPage;
  productName: string;
}): Promise<boolean> {
  return (
    brand.domain === product.domain ||
    (linksToDomain({ domain: brand.domain, page: product }) &&
      (await vouchesFor({ brand, product, productName })))
  );
}

/**
 * Under a page with a path, such as a code repository where anyone may open an issue or a pull
 * request, only what its maker publishes counts: the page itself and its releases and tags. A
 * homepage link would make its whole host official, so it counts for nothing.
 */
function isPublishedAt({ link, url }: { link: string; url: string }): boolean {
  const rest = readPathUnder({ base: link, url });

  return (
    rest !== null &&
    toPath(link) !== "" &&
    !COLLABORATION_PATH.test(toPath(url)) &&
    (rest === "" || RELEASES_PATH.test(rest) || RELEASES_PAGE.test(toPath(link)))
  );
}

/**
 * Docs and releases pages count on the brand's domain or the product's site, or under an address the
 * product page links to, such as its code repository's releases.
 */
export function isOfficialPage({ sites, url }: { sites: ProductSites; url: string }): boolean {
  const domain = toRegistrableDomain(url);
  const { product } = sites;

  return (
    domain !== null &&
    (domain === sites.brand.domain ||
      (toPath(product.url) === "" && domain === product.domain) ||
      [product.url, ...product.links].some((link) => isPublishedAt({ link, url })))
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
    tags: readPageTags({ html: decodeHtml(fetched.bytes), url: fetched.url }),
    url: fetched.url,
  };
}

/**
 * A brand is a site, named by its homepage. With no brand page found, a product's registrable
 * domain's homepage names it: a product site's root is its maker's site, and a product on a
 * subdomain ("developer.lumen.example") belongs to its domain. A page with a path, such as an
 * organization on a code host, names no brand, nor does a product under a path on a host of its own.
 */
function findBrandHome({ brandUrl, product }: { brandUrl: string | null; product: InspectedPage }) {
  if (brandUrl) {
    return toPath(brandUrl) === "" ? brandUrl : null;
  }

  return toHost(product.url) === product.domain && toPath(product.url) !== ""
    ? null
    : `https://${product.domain}/`;
}

/**
 * Brand identity is the domain of the homepage the server fetched, never a model's word, and a
 * homepage that redirects to another domain names none. Null when a page isn't HTML on a registrable
 * domain or the sites aren't tied.
 */
export async function inspectProductSites({
  brandUrl,
  productName,
  productUrl,
}: {
  brandUrl: string | null;
  /** A search hint, only choosing which brand pages to read for a link to the product. */
  productName: string;
  productUrl: string;
}): Promise<ProductSites | null> {
  const product = await inspectPage(productUrl);
  const brandHome = product && findBrandHome({ brandUrl, product });
  const brand = brandHome && (await inspectPage(brandHome));

  if (
    !product ||
    !brand ||
    brand.domain !== toRegistrableDomain(brandHome) ||
    !(await isProductOfBrand({ brand, product, productName }))
  ) {
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
