import { loadGoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { sleep } from "workflow";
import { saveAnswerInputs } from "../../../../../packages/core/src/view-models/onboarding/_utils/save-onboarding-answer";
import { waitForGraphInputs } from "./goal-content-inputs";

describe(waitForGraphInputs, () => {
  it.each(["exam", "language", "learn"] as const)(
    "starts a shared %s graph while personal questions are unanswered",
    async (kind) => {
      const user = await userFixture();

      const goal = await goalFixture({
        details: {
          answered: [],
          followUps: [{ answer: null, question: "Which tasks?" }],
          onboardingId: crypto.randomUUID(),
          ...(kind === "learn" && { level: "basic", purpose: "work" }),
        },
        kind,
        targetLanguage: kind === "language" ? "it" : null,
        userId: user.id,
      });

      const initial = await loadGoalCurriculumInputs(goal.id);

      if (!initial) {
        throw new Error("Expected curriculum inputs");
      }

      await expect(
        waitForGraphInputs({
          initial,
          scope: { generalGoal: "Accounting", language: "en", ownerId: null, targetLanguage: null },
        }),
      ).resolves.toStrictEqual(initial);

      expect(sleep).not.toHaveBeenCalled();
    },
  );

  it("owes a rebuild for a late answer after the gate timed out", async () => {
    const user = await userFixture();

    const goal = await goalFixture({
      details: { answered: [], onboardingId: crypto.randomUUID() },
      planRevealedAt: null,
      userId: user.id,
    });

    const initial = await loadGoalCurriculumInputs(goal.id);

    if (!initial) {
      throw new Error("Expected curriculum inputs");
    }

    await waitForGraphInputs({
      initial,
      scope: { generalGoal: "Accounting", language: "en", ownerId: null, targetLanguage: null },
    });

    expect(sleep).toHaveBeenCalledTimes(59);
    const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
    await saveAnswerInputs({ goal: saved, input: { purpose: "deep", question: "purpose" } });

    await expect(prisma.followUp.findMany({ where: { userId: user.id } })).resolves.toMatchObject([
      { input: { goalId: goal.id }, kind: "rebuildGoalCurriculum" },
    ]);
  });

  it("waits for a private learn graph's role and follow-ups, then uses those answers", async () => {
    const user = await userFixture();

    const details = {
      answered: [],
      followUps: [{ answer: null, question: "Which tasks?" }],
      level: "basic",
      onboardingId: crypto.randomUUID(),
      purpose: "work",
    };

    const goal = await goalFixture({ details, userId: user.id });
    const initial = await loadGoalCurriculumInputs(goal.id);

    if (!initial) {
      throw new Error("Expected curriculum inputs");
    }

    vi.mocked(sleep).mockImplementationOnce(async () => {
      await expect(
        prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
      ).resolves.toMatchObject({ curriculumQuestions: [] });

      await prisma.goal.update({
        data: {
          details: {
            ...details,
            answered: ["role", "followUps"],
            followUps: [{ answer: "Reports", question: "Which tasks?" }],
            role: "Accountant",
          },
        },
        where: { id: goal.id },
      });
    });

    await expect(
      waitForGraphInputs({
        initial,
        scope: { generalGoal: null, language: "en", ownerId: user.id, targetLanguage: null },
      }),
    ).resolves.toMatchObject({ graphPrompt: { context: expect.stringContaining("Accountant") } });

    expect(sleep).toHaveBeenCalledExactlyOnceWith("3s");
  });
});
