type EvidencePage = {
  locator: (selector: string) => { first: () => { isVisible: () => Promise<boolean> } };
};

export async function hasEvidence(page: EvidencePage, selectors: readonly string[]) {
  const visible = await Promise.all(
    selectors.map((selector) => page.locator(selector).first().isVisible()),
  );

  return visible.every(Boolean);
}
