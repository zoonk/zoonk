import { prisma } from "@zoonk/db";
import { levelTestQuestions } from "@zoonk/testing/fixtures/level-tests";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { CEFR_LEVELS } from "@zoonk/utils/cefr";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { answerLanguageLevelTest } from "../language/level-test/answer-language-level-test";
import { finishLanguageLevelTest } from "../language/level-test/finish-language-level-test";
import { startLanguageLevelTest } from "../language/level-test/start-language-level-test";
import { addSkillEvidence } from "../language/levels/record-language-evidence";
import { LEVEL_WINDOW_ANSWERS } from "../sessions/_utils/living-plan-window";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";
import { refreshGoalPlan } from "./refresh-goal-plan";

async function takeTest(
  goalId: string,
  pair: { language: string; targetLanguage: string },
  path: "lower" | "pass" | "practice" | "defer",
) {
  const questions = levelTestQuestions(CEFR_LEVELS);

  const confirmations = questions.map(({ answerIndex, ...question }) => ({
    ...question,
    answerIndices: [answerIndex, 2],
    id: `check-${question.id}`,
    options: [...question.options, "e"],
  }));

  await prisma.languageLevelTest.create({
    data: {
      ...pair,
      content: { confirmations, questions },
      model: "test",
      promptVersion: "test",
      runId: "test",
    },
  });

  const started = await startLanguageLevelTest({ goalId });

  if (started.status !== "ready" || !started.test.attemptId) {
    throw new Error("Expected an attempt");
  }

  const { attemptId } = started.test;
  let view = started.test;

  while (
    view.status === "ready" &&
    (view.next.kind === "question" || view.next.kind === "confirmation")
  ) {
    const { kind, question } = view.next;

    // oxlint-disable-next-line no-await-in-loop -- Each response supplies the next question.
    const answer = await answerLanguageLevelTest({
      goalId,
      input: {
        answerIndex:
          kind === "confirmation" ||
          path === "lower" ||
          (path === "defer" && question.skill === "listening")
            ? null
            : 0,
        attemptId,
        questionId: question.id,
        ...(kind === "confirmation" && { answerIndices: [0, 2] }),
        ...(path === "defer" && question.skill === "listening" && { audioDeferred: true }),
      },
    });

    if (answer.status !== "ready") {
      throw new Error("Expected an accepted answer");
    }

    view = answer.test;
  }

  const result = await finishLanguageLevelTest(goalId, attemptId);

  return result.status === "ready" ? result.result?.end : result.status;
}

describe("the first lesson after language placement", () => {
  it.each([
    { expected: 1, expectedEnd: null, path: "skip" },
    { expected: 1, expectedEnd: "audio_deferred", path: "defer" },
    { expected: 0, expectedEnd: "unknown_streak", path: "lower" },
    { expected: 3, expectedEnd: "check_passed", path: "pass" },
    { expected: 2, expectedEnd: "check_passed", path: "practice" },
    { expected: 1, expectedEnd: "unknown_streak", path: "raise" },
  ] as const)(
    "replans after $path for the same stated level",
    async ({ path, expected, expectedEnd }) => {
      const user = await userFixture();
      const bands = ["beginner", "intermediate", "intermediate", "advanced"] as const;

      const library = await planLibraryFixture({
        skills: bands.map((level) => ({ lessons: 1, level })),
      });

      const pair = { language: `x${crypto.randomUUID().slice(0, 8)}`, targetLanguage: "ja" };

      const { goal, plan } = await unplannedGoalFixture({
        ...pair,
        details: { level: "B1+", targetScore: "C2" },
        kind: "language",
        userId: user.id,
      });

      await Promise.all(
        library.skills.map((skill, i) =>
          prisma.skill.update({
            data: { cefrLevel: (["A1", "B1", "B2", "C1"] as const)[i] },
            where: { id: skill.id },
          }),
        ),
      );

      await createGoalPlan({ goalId: goal.id, graph: library.graph });
      mockSession(user.id);

      const end =
        path === "skip" ? null : await takeTest(goal.id, pair, path === "raise" ? "lower" : path);

      expect(end).toBe(expectedEnd);

      if (path === "practice") {
        await prisma.$transaction((tx) =>
          addSkillEvidence(tx, {
            evidence: { ceiling: 4, correct: 0, total: LEVEL_WINDOW_ANSWERS },
            language: pair.targetLanguage,
            skill: "listening",
            startScore: 2,
            userId: user.id,
          }),
        );
      }

      if (path === "raise") {
        for (const skill of ["reading", "listening"] as const) {
          // Each window adds half a CEFR level. Four raise the measured A1 to B1.
          for (let window = 0; window < 4; window += 1) {
            // oxlint-disable-next-line no-await-in-loop -- Each window works from the previous live score.
            await prisma.$transaction((tx) =>
              addSkillEvidence(tx, {
                evidence: {
                  ceiling: 1.5,
                  correct: LEVEL_WINDOW_ANSWERS,
                  total: LEVEL_WINDOW_ANSWERS,
                },
                language: pair.targetLanguage,
                skill,
                startScore: 0,
                userId: user.id,
              }),
            );
          }
        }
      }

      await refreshGoalPlan({ goalId: goal.id, mode: "forced" });

      const first = await prisma.planItem.findFirstOrThrow({
        orderBy: [{ scheduledFor: "asc" }, { position: "asc" }],
        where: { kind: "lesson", planId: plan.id, status: "todo" },
      });

      expect(first.skillId).toBe(library.skills[expected]?.id);
    },
  );
});
