import { type Locator, type Page } from "@playwright/test";
import { type Scenario } from "./shape.mts";

type EvidencePage = {
  locator: (selector: string) => {
    filter: (options: { visible: true }) => { count: () => Promise<number> };
  };
};

export async function hasEvidence(page: EvidencePage, selectors: readonly string[]) {
  const counts = await Promise.all(
    selectors.map((selector) => page.locator(selector).filter({ visible: true }).count()),
  );

  return counts.every(Boolean);
}

export function scenarioField(page: Page, field: string): Locator {
  return page.getByLabel(field, { exact: true }).or(page.getByPlaceholder(field, { exact: true }));
}

export async function hasProof({
  page,
  scenario,
  words,
}: {
  page: Page;
  scenario: Scenario;
  words: string;
}): Promise<boolean> {
  const region = scenario.proofWithin ? page.locator(scenario.proofWithin) : page;

  if (scenario.firstPaint) {
    return (await region.locator("[aria-busy=true]").filter({ visible: true }).count()) === 1;
  }

  const fill = scenario.reach?.find((step) => "fill" in step && step.fill.value === scenario.proof);

  if (fill && "fill" in fill) {
    const field = scenarioField(page, fill.fill.field).filter({ visible: true });
    return (await field.count()) === 1 && (await field.inputValue()) === words;
  }

  const matches = await region.getByText(words, { exact: true }).filter({ visible: true }).count();

  if (matches > 1) {
    throw new Error(
      `"${words}" matches ${matches} visible elements. Use words unique to the state or scope the proof to its region.`,
    );
  }

  return matches === 1;
}
