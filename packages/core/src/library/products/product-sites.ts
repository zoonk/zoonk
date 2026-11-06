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

function linksToDomain({ domain, page }: { domain: string; page: InspectedPage }): boolean {
  return page.tags.links.some((link) => toRegistrableDomain(link) === domain);
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
  if (linksToDomain({ domain: product.domain, page: brand })) {
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
      linksToDomain({ domain: product.domain, page: result.value }),
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
    tags: readPageTags({ html: decodeHtml(fetched.bytes), url: fetched.url }),
    url: fetched.url,
  };
}

/**
 * Brand identity is the domain of the address the server fetched, never a model's word. With no
 * brand page found, the brand is the product site's registrable domain, so a product on a brand's
 * subdomain ties to it. Null when a page isn't HTML on a registrable domain or the sites aren't tied.
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
  const brand = product && (await inspectPage(brandUrl ?? `https://${product.domain}/`));

  if (!product || !brand || !(await isProductOfBrand({ brand, product, productName }))) {
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
