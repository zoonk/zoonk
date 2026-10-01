import { type Page, expect, test } from "./fixtures";

/** `/start` in every interface language: the question and the examples in that language. */
const LOCALES = [
  { heading: "What do you want to achieve?", path: "/start" },
  { heading: "¿Qué quieres conseguir?", path: "/es/start" },
  { heading: "O que você quer alcançar?", path: "/pt/start" },
  { heading: /^Qu['’]est-ce que tu veux accomplir\s+\?$/u, path: "/fr/start" },
  { heading: "Was möchtest du erreichen?", path: "/de/start" },
] as const;

async function expectGoalQuestion(page: Page, { heading, path }: (typeof LOCALES)[number]) {
  await page.goto(path);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
  await expect(page.getByRole("textbox")).toBeVisible();
  await expect(page.getByRole("region", { name: /./u }).getByRole("listitem")).toHaveCount(5);
}

test("/start asks for the goal in each interface language", async ({ page }) => {
  for (const locale of LOCALES) {
    // oxlint-disable-next-line no-await-in-loop -- One page visits each language in turn.
    await expectGoalQuestion(page, locale);
  }
});
