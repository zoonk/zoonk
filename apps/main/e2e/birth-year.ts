import { E2E_BIRTH_YEAR } from "@zoonk/e2e/fixtures/users";
import { type Page, expect } from "./fixtures";

/** A visitor's first start asks their birth year before their guest is made. */
export async function answerBirthYear(page: Page, birthYear = E2E_BIRTH_YEAR) {
  const dialog = page.getByRole("dialog", { name: "What year were you born?" });
  await dialog.getByLabel("Birth year").fill(String(birthYear));
  await dialog.getByRole("button", { name: /^Continue/u }).click();
  await expect(dialog).toBeHidden();
}
