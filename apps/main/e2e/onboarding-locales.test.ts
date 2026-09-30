import { expect, test } from "./fixtures";

/** `/start` in every interface language: the question and the examples in that language. */
const LOCALES = [
  { heading: "What do you want to achieve?", path: "/start" },
  { heading: "¿Qué quieres conseguir?", path: "/es/start" },
  { heading: "O que você quer alcançar?", path: "/pt/start" },
  { heading: /^Qu['’]est-ce que tu veux accomplir\s+\?$/u, path: "/fr/start" },
  { heading: "Was möchtest du erreichen?", path: "/de/start" },
] as const;

for (const { heading, path } of LOCALES) {
  test.describe(path, () => {
    test("asks for the goal in its language", async ({ page }) => {
      await page.goto(path);

      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
      await expect(page.getByRole("textbox")).toBeVisible();
      await expect(page.getByRole("region", { name: /./u }).getByRole("listitem")).toHaveCount(5);
    });
  });
}
