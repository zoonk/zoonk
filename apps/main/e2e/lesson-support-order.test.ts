import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { lessonSkillFixture } from "@zoonk/testing/fixtures/library-lessons";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { type Page, expect, test } from "./fixtures";
import { MODES, type Mode, setDeviceMode } from "./learn-personas";

/**
 * Support per skill: a lesson on a skill the learner never answered opens with its explanation;
 * the same lesson, for a learner who already answered that skill, opens with a question.
 */

const EXPLANATION_TITLE = "A cloud, not a little ball";
const CHECK_QUESTION = 'What does the electron "cloud" show?';

async function createLessonFor({
  knowsSkill,
  mode,
  userId,
}: {
  knowsSkill: boolean;
  mode: Mode;
  userId: string;
}) {
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
    knowsSkill && learnerSkillFixture({ reps: 2, skillId: skill.id, state: "learning", userId }),
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

for (const mode of MODES) {
  test.describe(`How a lesson opens in ${mode} mode`, () => {
    test("a new skill starts with its explanation", async ({
      noProgressUser,
      userWithoutProgress: page,
    }) => {
      const lesson = await createLessonFor({ knowsSkill: false, mode, userId: noProgressUser.id });

      await passHook(page, { lessonId: lesson.id, mode });

      await expect(page.getByText(EXPLANATION_TITLE)).toBeVisible();
      await expect(page.getByText(CHECK_QUESTION)).toBeHidden();
    });

    test("a skill the learner already answered starts with a question, then the explanation", async ({
      noProgressUser,
      userWithoutProgress: page,
    }) => {
      const lesson = await createLessonFor({ knowsSkill: true, mode, userId: noProgressUser.id });

      await passHook(page, { lessonId: lesson.id, mode });

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
}
