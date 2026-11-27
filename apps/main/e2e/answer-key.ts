import { type Locator, type Page, expect } from "@playwright/test";
import { expectHydrated } from "@zoonk/e2e/hydration";

export async function pressAnswerKey(page: Page, answer: Locator) {
  await expectHydrated(answer);
  await expect(answer).toHaveAttribute("aria-keyshortcuts", /^[1-9]$/u);
  const key = await answer.getAttribute("aria-keyshortcuts");

  if (!key) {
    throw new Error("The answer has no number key shortcut");
  }

  await page.keyboard.press(key);
}
