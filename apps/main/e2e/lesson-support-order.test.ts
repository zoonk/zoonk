import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { lessonSkillFixture } from "@zoonk/testing/fixtures/library-lessons";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { type Page, expect, test } from "./fixtures";
import { type Mode, setDeviceMode } from "./learn-personas";

/**
 * Support per skill: a lesson on a skill the learner already answered opens with a question. A
 * never-answered skill keeps the lesson's own order (explanation first), which every other lesson
 * flow plays; core's and the player's tests cover that choice.
 */

const EXPLANATION_TITLE = "A cloud, not a little ball";
const CHECK_QUESTION = 'What does the electron "cloud" show?';

/** A lesson on a skill the learner already answered twice. */
async function createLessonFor({ mode, userId }: { mode: Mode; userId: string }) {
  const skill = await skillFixture();

  const [{ lesson }] = await Promise.all([
    playableLessonFixture({
      steps: [
        "hook",
        { kind: "explanation", skillId: skill.id },
        { kind: "check", skillId: skill.id },
        "summary",
      ],
    }),
    learningProfileFixture({ experienceMode: mode, userId }),
    learnerSkillFixture({ reps: 2, skillId: skill.id, state: "learning", userId }),
  ]);

  await lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id });

  return lesson;
}

async function passHook(page: Page, { lessonId, mode }: { lessonId: string; mode: Mode }) {
  await setDeviceMode(page.context(), mode);
  await page.goto(`/learn/${lessonId}`);

  await page.getByRole("radio", { name: "No" }).click();
  await page.getByRole("button", { name: /^See the answer/u }).click();
  await page.getByRole("button", { name: /^Continue/u }).click();
}

test.describe("How a lesson opens", () => {
  test("a skill the learner already answered starts with a question, then the explanation", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const lesson = await createLessonFor({ mode: "fun", userId: noProgressUser.id });

    await passHook(page, { lessonId: lesson.id, mode: "fun" });

    await expect(page.getByText(CHECK_QUESTION)).toBeVisible();
    await expect(page.getByRole("button", { name: "Explain first" })).toBeVisible();

    await page
      .getByRole("radio", { name: "Where the electron is most likely to be found" })
      .click();

    await page.getByRole("button", { name: /^Check/u }).click();
    await expect(page.getByRole("status").filter({ hasText: "Correct!" })).toBeVisible();
    await page.getByRole("button", { name: /^Continue/u }).click();

    await expect(page.getByText(EXPLANATION_TITLE)).toBeVisible();
  });
});
