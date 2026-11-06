import { type ProductHints, type SourceResearchPlan } from "@zoonk/ai/tasks/research/source-plan";
import { toNameKey } from "@zoonk/core/library/products/keys";
import { type GoalProductLink } from "@zoonk/core/library/products/link-goal";
import { claimRunToken, waitForRunToken } from "../_shared/run-token";
import { type ResearchResult } from "./research-result";
import { type ResearchContext } from "./research-sources";
import { linkGoalToSourcesStep } from "./steps/link-goal-step";
import { planSourceResearchStep } from "./steps/plan-research-step";
import {
  type KnownProduct,
  copyBrandLogoStep,
  copyProductImageStep,
  findCourseProductStep,
  findProductPagesStep,
  findProductStep,
  inspectProductSitesStep,
  linkGoalProductStep,
  markProductCheckedStep,
  readProductPagesStep,
  refreshProductReleasesStep,
  saveProductReleasesStep,
  saveProductResearchStep,
  storeProductPageStep,
} from "./steps/product-steps";

type ProductContext = ResearchContext<SourceResearchPlan>;

const READY: ResearchResult = { examBlueprintId: null, sourceIds: [], status: "ready" };
const NOT_FOUND: ResearchResult = { reason: "noOfficialSource", status: "needsUpload" };

type Research = Pick<ProductContext, "analytics" | "plan"> & { hints: ProductHints };

/** Joins a run already holding `token`; true when this run holds it and should do the work. */
async function claimOrWait(token: string): Promise<boolean> {
  const { conflict } = await claimRunToken(token);

  if (!conflict) {
    return true;
  }

  await waitForRunToken(token);
  return false;
}

function findKnown({ hints, plan }: Research): Promise<KnownProduct | null> {
  return findProductStep({ ...hints, officialDomains: plan.officialDomains });
}

type StoredPage = NonNullable<Awaited<ReturnType<typeof storeProductPageStep>>>;

/** Stored pages in reading order; a page that isn't official or didn't download is left out. */
async function storePages({
  language,
  sites,
  urls,
}: {
  language: string;
  sites: Parameters<typeof storeProductPageStep>[0]["sites"];
  urls: (string | null)[];
}): Promise<(StoredPage | null)[]> {
  const unique = [...new Set(urls.filter((url) => url !== null))];

  const stored = await Promise.allSettled(
    unique.map((url) => storeProductPageStep({ language, sites, url })),
  );

  return urls.map((url) => {
    const result = url ? stored[unique.indexOf(url)] : undefined;
    return result?.status === "fulfilled" ? result.value : null;
  });
}

async function copyMedia({
  iconUrl,
  imageUrl,
  organizationId,
  productId,
}: {
  iconUrl: string | null;
  imageUrl: string | null;
  organizationId: string;
  productId: string;
}): Promise<void> {
  // A missing logo or picture never costs the learner their product.
  await Promise.allSettled([
    iconUrl ? copyBrandLogoStep({ iconUrl, organizationId }) : null,
    imageUrl ? copyProductImageStep({ imageUrl, productId }) : null,
  ]);
}

/** Search, tie the sites by their fetched domains, read the official pages, then save. */
async function researchNewProduct(research: Research): Promise<GoalProductLink | null> {
  const { analytics, hints, plan } = research;

  const pages = await findProductPagesStep({
    analytics,
    hints,
    officialDomains: plan.officialDomains,
  });

  if (!pages.brandUrl || !pages.productUrl) {
    return null;
  }

  const [inspected] = await Promise.allSettled([
    inspectProductSitesStep({ brandUrl: pages.brandUrl, productUrl: pages.productUrl }),
  ]);

  const sites = inspected.status === "fulfilled" ? inspected.value : null;

  if (!sites) {
    return null;
  }

  const [brandPage, productPage, docs, releases, release] = await storePages({
    language: plan.language,
    sites,
    urls: [sites.brand.url, sites.product.url, pages.docsUrl, pages.releasesUrl, pages.releaseUrl],
  });

  if (!brandPage || !productPage) {
    return null;
  }

  const productIds = [
    ...new Set([productPage, docs, releases, release].flatMap((page) => page?.sourceId ?? [])),
  ];

  const reading = await readProductPagesStep({
    analytics,
    hints,
    language: plan.language,
    sourceIds: [...new Set([brandPage.sourceId, ...productIds])],
  });

  if (!reading.brand || !reading.product) {
    return null;
  }

  const saved = await saveProductResearchStep({
    learnerRelease: reading.learnerRelease,
    research: {
      brand: {
        description: reading.brand.description,
        domain: sites.brand.domain,
        name: reading.brand.name,
        website: sites.brand.url,
      },
      product: {
        aliases: reading.product.aliases,
        description: reading.product.description,
        docsUrl: docs?.url ?? null,
        name: reading.product.name,
        website: sites.product.url,
      },
      provenance: reading.provenance,
      releases: reading.releases,
      releasesHash: releases ? (reading.hashes[releases.sourceId] ?? null) : null,
      releasesSourceId: releases?.sourceId ?? null,
      sourceIds: productIds,
    },
  });

  await copyMedia({
    iconUrl: sites.brand.iconUrl,
    imageUrl: sites.product.imageUrl,
    organizationId: saved.organizationId,
    productId: saved.link.productId,
  });

  return saved.link;
}

/**
 * Re-reads the releases page only when its hash differs from the one the saved releases came from,
 * which also catches a refresh that saved the new hash and then failed before reading.
 */
async function refreshReleases({
  known,
  research,
}: {
  known: KnownProduct;
  research: Research;
}): Promise<KnownProduct> {
  const sourceId = known.product.releasesSourceId;

  if (!sourceId || !(await claimOrWait(`product:${known.product.id}`))) {
    return (await findKnown(research)) ?? known;
  }

  const [refreshed] = await Promise.allSettled([refreshProductReleasesStep(sourceId)]);
  const hash = refreshed.status === "fulfilled" ? refreshed.value : null;

  if (!hash || hash === known.product.releasesHash) {
    return known;
  }

  const reading = await readProductPagesStep({
    analytics: research.analytics,
    hints: { ...research.hints, brand: known.brand.name, name: known.product.name },
    known: true,
    language: research.plan.language,
    sourceIds: [sourceId],
  });

  await saveProductReleasesStep({
    productId: known.product.id,
    reading: {
      provenance: reading.provenance,
      releases: reading.releases,
      releasesHash: reading.hashes[sourceId] ?? hash,
      releasesSourceId: sourceId,
    },
  });

  return (await findKnown(research)) ?? known;
}

/** The product is known but not the release the learner named: search for that release alone. */
async function researchNamedRelease({
  known,
  research,
}: {
  known: KnownProduct;
  research: Research;
}): Promise<GoalProductLink> {
  const { analytics, hints, plan } = research;
  const releaseKey = toNameKey(hints.release ?? "");

  if (!(await claimOrWait(`product:${known.product.id}:${releaseKey}`))) {
    const joined = await findKnown(research);
    return joined?.link ?? known.link;
  }

  const pages = await findProductPagesStep({
    analytics,
    hints,
    knownWebsite: known.product.website,
    officialDomains: plan.officialDomains,
  });

  const [releasePage] = await storePages({
    language: plan.language,
    sites: known.sites,
    urls: [pages.releaseUrl],
  });

  if (!releasePage) {
    return known.link;
  }

  const reading = await readProductPagesStep({
    analytics,
    hints: { ...hints, brand: known.brand.name, name: known.product.name },
    known: true,
    language: plan.language,
    sourceIds: [releasePage.sourceId],
  });

  if (!reading.learnerRelease) {
    return known.link;
  }

  const saved = await saveProductResearchStep({
    learnerRelease: reading.learnerRelease,
    research: {
      brand: known.brand,
      product: known.product,
      provenance: reading.provenance,
      releases: reading.releases,
      releasesHash: null,
      releasesSourceId: null,
      sourceIds: [releasePage.sourceId],
    },
  });

  return saved.link;
}

async function researchKnownProduct({
  known,
  research,
}: {
  known: KnownProduct;
  research: Research;
}): Promise<GoalProductLink> {
  const current = known.isFresh ? known : await refreshReleases({ known, research });

  return research.hints.release && !current.hasNamedRelease
    ? researchNamedRelease({ known: current, research })
    : current.link;
}

/** One run researches a product; others with the same hints wait for it and look it up again. */
async function findOrResearchProduct(research: Research): Promise<GoalProductLink | null> {
  const known = await findKnown(research);

  if (known) {
    return researchKnownProduct({ known, research });
  }

  const { hints } = research;
  const token = `product:${toNameKey(hints.brand)}:${toNameKey(hints.name)}`;

  if (!(await claimOrWait(token))) {
    const joined = await findKnown(research);

    if (joined) {
      return researchKnownProduct({ known: joined, research });
    }
  }

  return researchNewProduct(research);
}

/**
 * A branded product's brand, product and releases come only from official pages research fetched,
 * shared by every learner of the product; known products cost no search, fetch or model call. Every
 * path records `productCheckedAt`, which the skill graph waits for.
 */
export async function researchProduct({
  analytics,
  goal,
  uploads,
}: Omit<ProductContext, "plan">): Promise<ResearchResult> {
  const fromCourse = await findCourseProductStep(goal.id);

  if (fromCourse) {
    await linkGoalProductStep({ goalId: goal.id, link: fromCourse });
    return READY;
  }

  // The learner's own material is what they study, as an upload after "not found" asked for.
  if (uploads.length > 0) {
    await linkGoalToSourcesStep({ goalId: goal.id, sourceIds: uploads });
    await markProductCheckedStep(goal.id);
    return { examBlueprintId: null, sourceIds: uploads, status: "ready" };
  }

  const plan = await planSourceResearchStep({ analytics, goal, topic: "product" });

  const link = plan.product
    ? await findOrResearchProduct({ analytics, hints: plan.product, plan })
    : null;

  if (!link) {
    await markProductCheckedStep(goal.id);
    return NOT_FOUND;
  }

  await linkGoalProductStep({ goalId: goal.id, link });
  return READY;
}
