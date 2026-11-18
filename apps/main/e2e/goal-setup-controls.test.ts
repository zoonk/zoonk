import { expectHydrated } from "@zoonk/e2e/hydration";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { expect, test } from "./fixtures";

test("requires a code before a learner can approve or deny a device login", async ({
  userWithoutProgress: page,
}) => {
  await page.goto("/device");

  const code = page.getByRole("textbox", { name: "Code from your terminal" });
  const approve = page.getByRole("button", { name: "Approve" });
  const deny = page.getByRole("button", { name: "Deny" });

  await expectHydrated(code);
  await expect(approve).toBeDisabled();
  await expect(deny).toBeDisabled();

  await code.fill("ABCD2345");
  await expect(approve).toBeEnabled();
  await expect(deny).toBeEnabled();

  await code.fill(" ");
  await expect(approve).toBeDisabled();
  await expect(deny).toBeDisabled();
});

test("requires an answer to continue past the follow-up questions", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const question = "Which instrument does the band need?";

  const goal = await goalFixture({
    details: {
      answered: ["purpose", "level"],
      followUps: [{ answer: null, question }],
      level: "none",
      purpose: "deep",
    },
    planRevealedAt: null,
    userId: noProgressUser.id,
  });

  await page.goto(`/start/${goal.id}`);

  const answer = page.getByRole("textbox", { name: question });
  const next = page.getByRole("button", { exact: true, name: "Continue" });

  await expectHydrated(answer);
  await expect(next).toBeDisabled();
  await expect(page.getByRole("button", { exact: true, name: "Skip" })).toBeEnabled();

  await answer.fill("Piano");
  await expect(next).toBeEnabled();
  await answer.fill(" ");
  await expect(next).toBeDisabled();
});

test("keeps the German goal box the same height when typing starts on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ height: 800, width: 360 });
  await page.goto("/de/start");

  const box = page.locator('[data-slot="goal-field"]');
  const goal = box.getByRole("textbox");
  await expectHydrated(goal);
  await expect(goal).toBeEmpty();
  await page.evaluate(() => document.fonts.ready.then(() => true));
  const emptyHeight = await box.evaluate((element) => element.getBoundingClientRect().height);

  await goal.pressSequentially("A");

  await expect(goal).toHaveValue("A");

  await expect
    .poll(() => box.evaluate((element) => element.getBoundingClientRect().height))
    .toBe(emptyHeight);
});
