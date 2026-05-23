import { type Page } from "@playwright/test";

/**
 * Mobile browsers clamp scroll when filtering removes content below a focused
 * search input. Aligning the field below the sticky nav reproduces the real
 * flow where learners search after reaching a catalog list.
 */
export async function scrollSearchInputToTop({ label, page }: { label: RegExp; page: Page }) {
  const input = page.getByLabel(label);

  await input.evaluate((element) => {
    const stickyNavOffset = 72;
    const top = element.getBoundingClientRect().top + globalThis.scrollY - stickyNavOffset;

    globalThis.scrollTo({ top });
  });
}

/**
 * Catalog search regressions here are visual position drift, so measuring the
 * accessible input gives the tests a direct signal without depending on CSS
 * selectors or component internals.
 */
export async function getSearchInputTop({ label, page }: { label: RegExp; page: Page }) {
  const box = await page.getByLabel(label).boundingBox();

  return box?.y ?? 0;
}
