import { prisma } from "@zoonk/db";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { answerLiveCalls } from "./live-peer";

const RENTING_UNIT = "Alugando um apartamento";

test.describe("Language unit page", () => {
  test("opens the unit from the Plan and runs a practice call to its saved result", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "language" }, async ({ page, user }) => {
      await answerLiveCalls(page, "answers");
      await page.goto("/plan");

      await page
        .getByRole("list", { name: "Your path" })
        .getByRole("link", { name: new RegExp(RENTING_UNIT, "u") })
        .click();

      await expect(page).toHaveURL(/\/content\/units\/[\da-f-]{36}$/u);
      await page.getByRole("button", { name: "Practice a conversation" }).click();
      const call = page.getByRole("dialog", { name: "Practice a conversation" });
      await call.getByRole("button", { name: "Start the call" }).click();
      await expect(page).toHaveURL(/\/conversation\/[\da-f-]{36}$/u);
      await page.getByRole("button", { name: "Start the call" }).click();

      await expect(
        page.getByRole("log", { name: "Conversation" }).getByText("Hi! Are you calling"),
      ).toBeVisible();

      await page.getByRole("button", { exact: true, name: "End" }).click();
      await expect(page.getByRole("img", { name: "2 of 3 stars" })).toBeVisible();

      const conversation = await prisma.languageConversation.findFirstOrThrow({
        where: { kind: "practice", userId: user.id },
      });

      expect(conversation).toMatchObject({ minutes: 2, status: "completed" });
    });
  });
});
