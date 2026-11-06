import {
  type ReleasesReading,
  readProductReleases,
  saveReadReleases,
} from "@zoonk/core/library/products/product-releases";

/** Null when the page's releases are read already. */
export async function readProductReleasesStep(
  input: Parameters<typeof readProductReleases>[0],
): Promise<ReleasesReading | null> {
  "use step";
  return readProductReleases(input);
}

/** Returns the product's followed main courses that are now behind. */
export async function saveProductReleasesStep(reading: ReleasesReading): Promise<string[]> {
  "use step";
  return saveReadReleases(reading);
}
