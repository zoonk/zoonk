import { type ServiceTier } from "@zoonk/ai/provider-options";
import { type GoalProductLink } from "@zoonk/core/library/products/link-goal";
import { type ResearchAnalytics } from "./_utils/research-analytics";
import {
  type KnownProduct,
  findProductPagesStep,
  readProductPagesStep,
  saveProductResearchStep,
  storeProductPageStep,
} from "./steps/product-steps";

/**
 * Searches a saved product's official sites for one release's own page, reads it and saves what it
 * states: a release the learner named that isn't stored, or the newest listed one when none is
 * current. Returns the goal's link for that release, or null when no page for it was found or its
 * reading keeps no such release.
 */
export async function readReleasePage({
  analytics,
  known,
  language,
  release,
  serviceTier,
}: {
  analytics: ResearchAnalytics;
  known: Pick<KnownProduct, "brand" | "product" | "sites">;
  language: string;
  release: string;
  serviceTier?: ServiceTier;
}): Promise<GoalProductLink | null> {
  const { brand, product, sites } = known;
  const hints = { brand: brand.name, name: product.name, release };

  const pages = await findProductPagesStep({
    analytics,
    hints,
    knownWebsite: product.website,
    officialDomains: [...new Set([sites.brand.domain, sites.product.domain])],
    serviceTier,
  });

  const page = pages.releaseUrl
    ? await storeProductPageStep({ language, sites, url: pages.releaseUrl })
    : null;

  if (!page) {
    return null;
  }

  const reading = await readProductPagesStep({
    analytics,
    brandDomain: brand.domain,
    hints,
    known: true,
    language,
    releasesPageIds: [page.sourceId],
    serviceTier,
    sourceIds: [page.sourceId],
  });

  if (!reading.learnerRelease) {
    return null;
  }

  const saved = await saveProductResearchStep({
    learnerRelease: reading.learnerRelease,
    research: {
      brand,
      product,
      provenance: reading.provenance,
      releases: reading.releases,
      releasesHash: null,
      releasesSourceId: null,
    },
  });

  return saved.link;
}
