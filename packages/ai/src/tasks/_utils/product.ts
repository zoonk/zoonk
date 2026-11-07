/** A product course's product, and the release it teaches; null for a product with no releases. */
export type PromptProduct = {
  brand: string;
  name: string;
  release: { name: string; releasedOn: string | null } | null;
};

function formatRelease(release: PromptProduct["release"]): string {
  if (!release) {
    return "";
  }

  const date = release.releasedOn ? ` (released ${release.releasedOn})` : "";
  return `, written for ${release.name}${date}`;
}

export function formatProduct(product: PromptProduct): string {
  return `PRODUCT: ${product.name} by ${product.brand}${formatRelease(product.release)}`;
}
