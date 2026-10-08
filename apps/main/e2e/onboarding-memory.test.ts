import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import {
  guardianLinkFixture,
  learningProfileFixture,
} from "@zoonk/testing/fixtures/learning-profiles";
import { type Page, expect, test } from "./fixtures";

/**
 * Memory starts off for learners under 18 and anyone who doesn't tell us their age, so onboarding
 * asks them once, with a one-tap yes, whether it may make their lessons more personal. "Not now"
 * keeps it off, and a guardian who turned memory off isn't overruled by the question.
 */

const QUESTION = "Use what you tell us to personalize your lessons?";
const ASK_AN_ADULT = /Not sure\? Ask a parent or guardian\./u;
const TEEN_BIRTH = { birthMonth: 1, birthYear: new Date().getUTCFullYear() - 15 };

/** A goal whose own questions are answered, so the learner's profile steps come next. */
function createGoal(userId: string) {
  return goalFixture({
    details: { answered: ["schedule", "targetDate"], level: "none", purpose: "overview" },
    kind: "learn",
    title: `Learn about volcanoes ${randomUUID().slice(0, 8)}`,
    userId,
  });
}

function readMemoryChoice(userId: string) {
  return prisma.userLearningProfile
    .findUnique({ select: { memoryEnabled: true }, where: { userId } })
    .then((profile) => profile?.memoryEnabled ?? null);
}

async function expectBuddyNext(page: Page) {
  await expect(page.getByRole("heading", { name: "Choose your buddy" })).toBeVisible();
}

test.describe("Onboarding memory question", () => {
  test("a teen says yes in one tap and memory turns on", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const [goal] = await Promise.all([
      createGoal(noProgressUser.id),
      learningProfileFixture({ ...TEEN_BIRTH, userId: noProgressUser.id }),
    ]);

    await page.goto(`/start/${goal.id}`);
    await expect(page.getByRole("heading", { name: QUESTION })).toBeVisible();
    await expect(page.getByText(ASK_AN_ADULT)).toBeVisible();
    await expect(page.getByText(/We remember your goals and how you learn/u)).toBeVisible();
    await expectAccessibleScreen(page, "the memory question");

    await page.getByRole("button", { name: "Yes, personalize them" }).click();
    await expectBuddyNext(page);

    await expect.poll(() => readMemoryChoice(noProgressUser.id)).toBe(true);
  });

  test("a learner who doesn't give their age gets the same choice, and Not now keeps memory off", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const goal = await createGoal(noProgressUser.id);

    await page.goto(`/start/${goal.id}`);
    await expect(page.getByRole("heading", { name: "When were you born?" })).toBeVisible();
    await page.getByRole("button", { name: "Prefer not to say" }).click();

    await expect(page.getByRole("heading", { name: QUESTION })).toBeVisible();
    await expect(page.getByText(ASK_AN_ADULT)).toBeHidden();

    await page.getByRole("button", { name: "Not now" }).click();
    await expectBuddyNext(page);

    await expect.poll(() => readMemoryChoice(noProgressUser.id)).toBe(false);

    await page.goto("/settings/memory");
    await expect(page.getByRole("switch", { name: "Use memory" })).not.toBeChecked();
  });

  test("a guardian's memory off wins: the question isn't asked and memory stays off", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const [goal] = await Promise.all([
      createGoal(noProgressUser.id),
      learningProfileFixture({ ...TEEN_BIRTH, userId: noProgressUser.id }),
      guardianLinkFixture({
        acceptedAt: new Date(),
        memoryOff: true,
        status: "active",
        userId: noProgressUser.id,
      }),
    ]);

    await page.goto(`/start/${goal.id}`);
    await expectBuddyNext(page);
    await expect(page.getByRole("heading", { name: QUESTION })).toBeHidden();

    await page.goto("/settings/memory");
    await expect(page.getByText("Your guardian turned memory off.")).toBeVisible();
    await expect(page.getByRole("switch", { name: "Use memory" })).toBeDisabled();
    await expect.poll(() => readMemoryChoice(noProgressUser.id)).toBeNull();
  });
});
