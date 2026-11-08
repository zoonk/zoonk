import { randomBytes } from "node:crypto";
import { expectHydrated } from "@zoonk/e2e/hydration";
import { lettersOnly, translatePage } from "@zoonk/e2e/page-translation";
import { expect, test } from "./fixtures";

test("a page the browser translates keeps working when React replaces the translated text", async ({
  userWithoutProgress: page,
}) => {
  const username = `translated_${lettersOnly(randomBytes(8))}`;

  await page.goto("/profile");
  const field = page.getByRole("textbox", { name: "Username" });
  await expectHydrated(field);
  await translatePage(page);

  // "Checking..." sits beside a spinner, so React removes its own text node when the check ends.
  await field.fill(username);
  await expect(page.getByText(`[${username} is available]`)).toBeVisible();
});
