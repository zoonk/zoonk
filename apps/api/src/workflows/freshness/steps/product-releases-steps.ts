import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { readProductPages } from "@zoonk/ai/tasks/research/read-product-pages";
import {
  type CheckedProductRelease,
  checkProductReading,
} from "@zoonk/core/library/products/product-reading";
import {
  loadUnreadReleasesPage,
  saveCheckedReleases,
} from "@zoonk/core/library/products/product-releases";
import { type ResearchAnalytics } from "../../research/_utils/research-analytics";

export type ReleasesReading = {
  contentHash: string;
  productId: string;
  provenance: Awaited<ReturnType<typeof readProductPages>>["provenance"];
  releases: CheckedProductRelease[];
  sourceId: string;
};

/** Null when another check read the page meanwhile. */
export async function readProductReleasesStep({
  analytics,
  productId,
}: {
  analytics: ResearchAnalytics;
  productId: string;
}): Promise<ReleasesReading | null> {
  "use step";

  const unread = await loadUnreadReleasesPage(productId);

  if (!unread) {
    return null;
  }

  const { data, provenance } = await readProductPages({
    analytics,
    hints: unread.hints,
    known: true,
    pages: [unread.page],
    serviceTier: chooseServiceTier({ wait: "later" }),
  });

  const checked = checkProductReading({ pages: [unread.page], reading: data });

  return {
    contentHash: unread.contentHash,
    productId,
    provenance,
    releases: checked.releases,
    sourceId: unread.sourceId,
  };
}

/** Returns the product's followed main courses that are now behind. */
export async function saveProductReleasesStep(reading: ReleasesReading): Promise<string[]> {
  "use step";
  return saveCheckedReleases(reading);
}
