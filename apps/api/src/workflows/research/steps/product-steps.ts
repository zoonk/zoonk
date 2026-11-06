import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { findProductPages } from "@zoonk/ai/tasks/research/find-product-pages";
import { type ProductHints } from "@zoonk/ai/tasks/research/source-plan";
import { scheduleFreshnessChecks } from "@zoonk/core/library/exams/freshness-checks";
import { type ProductHints as LookupHints, findProduct } from "@zoonk/core/library/products/find";
import {
  findCourseProductLink,
  findProductCheckedSourceId,
} from "@zoonk/core/library/products/goal-link";
import { linkSavedProduct, toGoalProductLink } from "@zoonk/core/library/products/goal-release";
import { type GoalProductLink, linkGoalToProduct } from "@zoonk/core/library/products/link-goal";
import { copyBrandLogo, copyProductImage } from "@zoonk/core/library/products/media";
import { readProductSources } from "@zoonk/core/library/products/read-sources";
import {
  type ProductResearch,
  saveProductResearch,
} from "@zoonk/core/library/products/save-research";
import {
  type ProductSites,
  inspectProductSites,
  isOfficialPage,
  loadProductSites,
} from "@zoonk/core/library/products/sites";
import { PermanentDocumentError } from "@zoonk/core/library/sources/fetch";
import { refreshWebSource, storeWebSource } from "@zoonk/core/library/sources/web";
import { safeAsync } from "@zoonk/utils/error";
import { FatalError } from "workflow";
import { type ResearchAnalytics } from "../_utils/research-analytics";

/** The goal's courses wait on research, so its calls run at the learner's tier. */
const serviceTier = chooseServiceTier({ wait: "learner" });

/** A page that can never be downloaded fails at once instead of retrying. */
async function failPermanently<T>(work: () => Promise<T>): Promise<T> {
  const { data, error } = await safeAsync(work);

  if (error instanceof PermanentDocumentError) {
    throw new FatalError(error.message);
  }

  if (error) {
    throw error;
  }

  return data;
}

export async function findCourseProductStep(goalId: string): Promise<GoalProductLink | null> {
  "use step";
  return findCourseProductLink(goalId);
}

/** Records that research decided, linking nothing; the skill graph waits for it. */
export async function markProductCheckedStep(goalId: string): Promise<void> {
  "use step";
  await linkGoalToProduct({ goalId, link: null });
}

/** Links the goal, then keeps the product's checked page fresh while learners use it. */
export async function linkGoalProductStep({
  goalId,
  link,
}: {
  goalId: string;
  link: GoalProductLink;
}): Promise<void> {
  "use step";

  await linkGoalToProduct({ goalId, link });
  const sourceId = await findProductCheckedSourceId(link.productId);

  if (sourceId) {
    await scheduleFreshnessChecks({ targets: [{ kind: "source", sourceId }] });
  }
}

export type KnownProduct = {
  brand: ProductResearch["brand"];
  isFresh: boolean;
  link: GoalProductLink;
  /** Whether the learner's named release is stored. */
  hasNamedRelease: boolean;
  product: ProductResearch["product"] & {
    id: string;
    releasesHash: string | null;
    releasesSourceId: string | null;
  };
  sites: ProductSites;
};

/** Null when no product of the named brand matches, or the brand predates research. */
export async function findProductStep(hints: LookupHints): Promise<KnownProduct | null> {
  "use step";

  const now = new Date();
  const found = await findProduct({ hints, now });
  const organization = found?.product.organization;

  const sites =
    found && organization
      ? await loadProductSites({ brand: organization, product: found.product })
      : null;

  if (!found || !sites || !organization) {
    return null;
  }

  const { product } = found;

  return {
    brand: {
      description: organization.description ?? "",
      domain: sites.brand.domain,
      name: organization.name,
      website: sites.brand.url,
    },
    hasNamedRelease: found.namedRelease !== null,
    isFresh: found.isFresh,
    link: toGoalProductLink({
      current: found.currentRelease,
      named: found.namedRelease,
      now,
      productId: product.id,
    }),
    product: {
      aliases: product.aliases,
      description: product.description,
      docsUrl: product.docsUrl,
      id: product.id,
      name: product.name,
      releasesHash: product.releasesHash,
      releasesSourceId: product.releasesSourceId,
      website: product.website,
    },
    sites,
  };
}

export async function findProductPagesStep({
  analytics,
  hints,
  knownWebsite,
  officialDomains,
}: {
  analytics: ResearchAnalytics;
  hints: ProductHints;
  knownWebsite?: string;
  officialDomains: string[];
}) {
  "use step";

  const { data } = await findProductPages({
    analytics,
    hints,
    knownWebsite,
    officialDomains,
    serviceTier,
  });

  return data;
}

export async function inspectProductSitesStep(pages: {
  brandUrl: string;
  productUrl: string;
}): Promise<ProductSites | null> {
  "use step";
  return failPermanently(() => inspectProductSites(pages));
}

/**
 * Null when the address isn't official (`isOfficialPage`); one that redirects off the official sites
 * fails without being stored. Titled by its address: the product's name is a claim until read.
 */
export async function storeProductPageStep({
  language,
  sites,
  url,
}: {
  language: string;
  sites: ProductSites;
  url: string;
}): Promise<{ sourceId: string; url: string } | null> {
  "use step";

  if (!isOfficialPage({ sites, url })) {
    return null;
  }

  const { hostname, pathname } = new URL(url);

  const source = await failPermanently(() =>
    storeWebSource({
      acceptUrl: (final) => isOfficialPage({ sites, url: final }),
      kind: "official",
      language,
      publisher: null,
      title: `${hostname.replace(/^www\./u, "")}${pathname.replace(/\/$/u, "")}`,
      topic: "product",
      url,
    }),
  );

  return { sourceId: source.id, url: source.url ?? url };
}

export async function readProductPagesStep(
  input: Omit<Parameters<typeof readProductSources>[0], "serviceTier">,
) {
  "use step";
  return readProductSources({ ...input, serviceTier });
}

/** Returns the goal's link: the learner's named release only when it's older than the current one. */
export async function saveProductResearchStep({
  learnerRelease,
  research,
}: {
  learnerRelease: string | null;
  research: ProductResearch;
}): Promise<{ link: GoalProductLink; organizationId: string }> {
  "use step";

  const saved = await saveProductResearch(research);

  return {
    link: linkSavedProduct({
      learnerRelease,
      now: new Date(),
      productId: saved.product.id,
      releases: saved.releases,
    }),
    organizationId: saved.organization.id,
  };
}

export async function refreshProductReleasesStep(sourceId: string): Promise<void> {
  "use step";
  await failPermanently(() => refreshWebSource(sourceId));
}

export async function copyBrandLogoStep(input: { iconUrl: string; organizationId: string }) {
  "use step";
  await failPermanently(() => copyBrandLogo(input));
}

export async function copyProductImageStep(input: { imageUrl: string; productId: string }) {
  "use step";
  await failPermanently(() => copyProductImage(input));
}
