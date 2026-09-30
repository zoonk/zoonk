import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { isJsonObject } from "@zoonk/utils/json";
import { expect, test } from "./fixtures";
import { MODES, type Mode } from "./learn-personas";
import { createStudyDay, openAs } from "./study-day";

/**
 * A first-week session: placement is still unsure about a skill, so today's review opens with one
 * placement question about it, the way the session builder puts it first.
 */
async function createFirstWeekDay(mode: Mode) {
  const day = await createStudyDay({ mode });
  const skill = await skillFixture({ name: `Ratios ${randomUUID()}` });

  const [item, review] = await Promise.all([
    itemFixture({ content: choiceItemContent(`Placement: ${randomUUID()}?`), skillId: skill.id }),
    prisma.studySessionBlock.findFirstOrThrow({
      where: { kind: "review", sessionId: day.session.id },
    }),
  ]);

  const payload = isJsonObject(review.payload) ? review.payload : {};

  await prisma.studySessionBlock.update({
    data: { payload: { ...payload, placementItemIds: [item.id] } },
    where: { id: review.id },
  });

  return { ...day, item };
}

for (const mode of MODES) {
  test.describe(`First-week placement in ${mode === "fun" ? "Fun" : "Focus"}`, () => {
    test("a placement question says what it's for and takes 'I don't know yet'", async ({
      browser,
    }) => {
      const { item, user } = await createFirstWeekDay(mode);
      const page = await openAs(browser, user);
      await page.goto("/today");

      await page.getByRole("button", { name: mode === "fun" ? /^Take off/u : /^Start/u }).click();

      await expect(page.getByRole("heading", { name: /^Placement:/u })).toBeVisible();

      await expect(
        page.getByText("Fine-tuning your plan. A miss here is never saved as a mistake."),
      ).toBeVisible();

      await page.getByRole("button", { name: "I don't know yet" }).click();
      await expect(page.getByRole("region", { name: "Answer feedback" })).toBeVisible();

      // The capsules come next, and the answer never became a mistake.
      await page.keyboard.press("Enter");
      await expect(page.getByRole("heading", { name: /^Capsule one/u })).toBeVisible();
      await expect(page.getByText("Fine-tuning your plan", { exact: false })).toBeHidden();

      await expect(
        prisma.mistake.count({ where: { itemId: item.id, userId: user.id } }),
      ).resolves.toBe(0);

      await page.context().close();
    });
  });
}
