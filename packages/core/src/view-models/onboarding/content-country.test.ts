import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { onboardingDraftFixture } from "@zoonk/testing/fixtures/onboarding-drafts";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { resolveNewGoalCountry } from "../../goals/_utils/goal-content-country";
import { type GoalDraft } from "../../goals/goal-contract";
import { updateGoal } from "../../goals/update-goal";
import { saveAnswerInputs } from "./_utils/save-onboarding-answer";
import { getMissingQuestions } from "./onboarding-steps";

const goal = { kind: "learn" as const, targetDate: null };

describe("content country question", () => {
  it("asks for an unresolved country before every other setup question", () => {
    expect(getMissingQuestions({ ...goal, details: { countryDependent: true } })[0]).toBe(
      "contentCountry",
    );
  });

  it("does not ask for a general subject", () => {
    expect(getMissingQuestions({ ...goal, details: { countryDependent: false } })).not.toContain(
      "contentCountry",
    );
  });

  it("does not ask again after a choice or an explicit skip", () => {
    expect(
      getMissingQuestions({
        ...goal,
        details: { answered: ["contentCountry"], countryDependent: true },
      }),
    ).not.toContain("contentCountry");
  });

  it("saves the first answer without changing home country or owing a second build", async () => {
    const user = await userFixture();
    await learningProfileFixture({ homeCountry: "DE", userId: user.id });

    const current = await goalFixture({
      details: { answered: [], countryDependent: true },
      planRevealedAt: null,
      userId: user.id,
    });

    await planFixture({ goalId: current.id });

    await expect(
      saveAnswerInputs({ goal: current, input: { country: "PT", question: "contentCountry" } }),
    ).resolves.toMatchObject({ status: "saved" });

    await expect(
      prisma.goal.findUniqueOrThrow({ where: { id: current.id } }),
    ).resolves.toMatchObject({ contentCountry: "PT" });

    await expect(
      prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ homeCountry: "DE" });

    await expect(
      prisma.followUp.count({ where: { key: current.id, kind: "rebuildGoalCurriculum" } }),
    ).resolves.toBe(0);
  });

  it("owes the initial build when a country answer arrives after the run stopped waiting", async () => {
    const user = await userFixture();

    const current = await goalFixture({
      curriculumQuestions: ["contentCountry"],
      details: { answered: [], countryDependent: true },
      userId: user.id,
    });

    await planFixture({ buildFailedAt: new Date(), goalId: current.id });

    await expect(
      saveAnswerInputs({ goal: current, input: { country: "PT", question: "contentCountry" } }),
    ).resolves.toMatchObject({ status: "saved" });

    await expect(
      prisma.followUp.findMany({ where: { key: current.id, kind: "rebuildGoalCurriculum" } }),
    ).resolves.toMatchObject([{ input: { goalId: current.id }, revision: 0 }]);
  });

  it("owes one rebuild when another tab or the goal's settings change the country the first build read", async () => {
    const user = await userFixture();

    const current = await goalFixture({
      curriculumQuestions: ["purpose", "level"],
      details: { answered: [], countryDependent: true },
      planRevealedAt: null,
      userId: user.id,
    });

    await planFixture({ goalId: current.id });

    const answer = (country: string) =>
      saveAnswerInputs({ goal: current, input: { country, question: "contentCountry" } });

    await answer("PT");
    await answer("PT");

    await expect(
      prisma.followUp.count({ where: { key: current.id, kind: "rebuildGoalCurriculum" } }),
    ).resolves.toBe(0);

    await answer("DE");
    await answer("DE");

    await expect(
      prisma.followUp.findMany({ where: { key: current.id, kind: "rebuildGoalCurriculum" } }),
    ).resolves.toMatchObject([{ input: { goalId: current.id }, revision: 0 }]);

    mockSession(user.id);
    await updateGoal({ goalId: current.id, input: { contentCountry: "ES" } });

    await expect(
      prisma.goal.findUniqueOrThrow({ where: { id: current.id } }),
    ).resolves.toMatchObject({ contentCountry: "ES", planRevealedAt: null });

    await expect(
      prisma.followUp.findMany({ where: { key: current.id, kind: "rebuildGoalCurriculum" } }),
    ).resolves.toMatchObject([{ input: { goalId: current.id }, revision: 1 }]);
  });

  it.each(["home", "picked"])(
    "preserves the reviewed %s source when the request omits its country code",
    async (source) => {
      const user = await userFixture();
      await learningProfileFixture({ homeCountry: "PT", userId: user.id });
      const title = "Personal finance";

      const card = await onboardingDraftFixture({
        understanding: {
          goals: [
            {
              contentCountry: { code: "PT", source },
              countryDependent: true,
              draft: { contentCountry: "PT", kind: "learn", title },
            },
          ],
          status: "goals",
        },
        userId: user.id,
      });

      const draft: GoalDraft = {
        details: { onboardingId: card.id },
        kind: "learn",
        language: "pt",
        prompt: title,
        title,
      };

      await expect(
        prisma.$transaction((tx) => resolveNewGoalCountry({ draft, tx, userId: user.id })),
      ).resolves.toMatchObject({ contentCountry: "PT", countryDependent: true, source });
    },
  );

  it("resolves the reading before home country and keeps the decision server-owned", async () => {
    const user = await userFixture();
    await learningProfileFixture({ homeCountry: "PT", userId: user.id });
    const title = "Personal finance";

    const card = await onboardingDraftFixture({
      understanding: {
        goals: [{ countryDependent: true, draft: { contentCountry: "DE", kind: "learn", title } }],
        status: "goals",
      },
      userId: user.id,
    });

    const draft: GoalDraft = {
      details: { countryDependent: false, onboardingId: card.id },
      kind: "learn",
      language: "pt",
      prompt: title,
      title,
    };

    const resolve = () =>
      prisma.$transaction((tx) => resolveNewGoalCountry({ draft, tx, userId: user.id }));

    await expect(resolve()).resolves.toMatchObject({
      contentCountry: "DE",
      countryDependent: true,
    });

    await prisma.onboardingDraft.update({
      data: {
        understanding: {
          goals: [{ countryDependent: true, draft: { kind: "learn", title } }],
          status: "goals",
        },
      },
      where: { id: card.id },
    });

    await expect(resolve()).resolves.toMatchObject({
      contentCountry: "PT",
      countryDependent: true,
      source: "home",
    });

    await prisma.userLearningProfile.update({
      data: { homeCountry: null },
      where: { userId: user.id },
    });

    await expect(resolve()).resolves.toMatchObject({
      contentCountry: null,
      countryDependent: true,
    });
  });
});
