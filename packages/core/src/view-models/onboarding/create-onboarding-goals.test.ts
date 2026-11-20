import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { onboardingDraftFixture } from "@zoonk/testing/fixtures/onboarding-drafts";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../../_test-utils/frozen-clock";
import { mockSession } from "../../_test-utils/mock-session";
import { moveLanguageGoalToExam } from "../../exams/move-language-goal";
import { type GoalDraft } from "../../goals/goal-contract";
import { isInputRangeError } from "../../plans/target-date-range";
import { getSession } from "../../users/get-session";
import { getLearnerToday } from "./_utils/understanding-view";
import { createOnboardingGoals } from "./create-onboarding-goals";
import { getOnboarding } from "./get-onboarding";

const dayAheadZone = "Pacific/Kiritimati";

function learnGoal(details: GoalDraft["details"]): GoalDraft {
  return {
    details: { purpose: "overview", ...details },
    kind: "learn",
    language: "en",
    prompt: "Learn chess",
    targetDate: getLearnerToday(dayAheadZone),
    title: "Learn chess",
  };
}

function cardGoal(onboardingId: string, title = "Learn chess"): GoalDraft {
  return { ...learnGoal({ onboardingId }), targetDate: undefined, title };
}

async function confirm(goals: GoalDraft[]) {
  const created = await createOnboardingGoals({ dailyMinutes: 30, goals, timeZone: "UTC" });
  return created.status === "created" ? created.goals.map((goal) => goal.id) : [];
}

function countClaims(userId: string) {
  return prisma.usageRecord.count({ where: { kind: "goal", userId } });
}

describe(createOnboardingGoals, () => {
  it("starts a card's goal whose date is no longer ahead without it, and setup asks the date", async () => {
    const user = await userFixture();
    mockSession(user.id);

    const created = await createOnboardingGoals({
      dailyMinutes: 15,
      goals: [learnGoal({ onboardingId: randomUUID() })],
      timeZone: dayAheadZone,
    });

    expect(created).toMatchObject({ goals: [{ targetDate: null }], status: "created" });

    const goalId = created.status === "created" ? (created.goals[0]?.id ?? "") : "";
    const setup = await getOnboarding({ goalId });

    expect(setup.status === "ready" && setup.onboarding.steps).toContain("targetDate");
  });

  it("counts a card's date from one moment, so a confirm that crosses midnight still starts", async () => {
    const user = await userFixture();
    freezeClock();
    vi.setSystemTime(new Date("2026-11-04T23:59:59.999Z"));
    mockSession(user.id);
    const signedIn = vi.mocked(getSession).getMockImplementation();

    vi.mocked(getSession).mockImplementation(async () => {
      vi.setSystemTime(new Date("2026-11-05T00:00:00.001Z"));
      return (await signedIn?.()) ?? null;
    });

    const created = await createOnboardingGoals({
      dailyMinutes: 15,
      goals: [{ ...learnGoal({ onboardingId: randomUUID() }), targetDate: "2026-11-05" }],
      timeZone: "UTC",
    });

    expect(created).toMatchObject({ goals: [{ targetDate: null }], status: "created" });
  });

  describe("confirming a card again", () => {
    it("returns the goal it made instead of making and charging another", async () => {
      const user = await userFixture();
      const card = await onboardingDraftFixture({ userId: user.id });
      mockSession(user.id);

      const first = await confirm([cardGoal(card.id)]);
      const again = await confirm([cardGoal(card.id)]);

      expect(first).toHaveLength(1);
      expect(again).toStrictEqual(first);
      await expect(prisma.goal.count({ where: { userId: user.id } })).resolves.toBe(1);
      await expect(countClaims(user.id)).resolves.toBe(1);
    });

    it("leaves the goal the learner studies now as it is", async () => {
      const user = await userFixture();

      const [first, second] = await Promise.all([
        onboardingDraftFixture({ userId: user.id }),
        onboardingDraftFixture({ userId: user.id }),
      ]);

      mockSession(user.id);

      await confirm([cardGoal(first.id)]);
      const [studied] = await confirm([cardGoal(second.id)]);
      await confirm([cardGoal(first.id)]);

      await expect(
        prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: user.id } }),
      ).resolves.toMatchObject({ activeGoalId: studied });
    });

    it("follows the runs the goal started, and starts them when none was saved", async () => {
      const user = await userFixture();
      const card = await onboardingDraftFixture({ userId: user.id });
      mockSession(user.id);

      const first = await createOnboardingGoals({
        dailyMinutes: 30,
        goals: [cardGoal(card.id)],
        timeZone: "UTC",
      });

      const goalId = first.status === "created" ? (first.goals[0]?.id ?? "") : "";

      const unstarted = await createOnboardingGoals({
        dailyMinutes: 30,
        goals: [cardGoal(card.id)],
      });

      await prisma.goal.update({
        data: { generationRunId: "wrun_curriculum", researchRunId: "wrun_research" },
        where: { id: goalId },
      });

      const started = await createOnboardingGoals({ dailyMinutes: 30, goals: [cardGoal(card.id)] });

      expect(first).toMatchObject({ replayed: [] });
      expect(unstarted).toMatchObject({ replayed: [] });

      expect(started).toMatchObject({
        replayed: [{ generationId: "wrun_curriculum", goalId, researchId: "wrun_research" }],
      });
    });

    it("returns the newest of two live goals at one place, after one is restored", async () => {
      const user = await userFixture();
      const card = await onboardingDraftFixture({ userId: user.id });
      mockSession(user.id);

      const [restored] = await confirm([cardGoal(card.id)]);
      await prisma.goal.update({ data: { status: "archived" }, where: { id: restored } });
      const [newest] = await confirm([cardGoal(card.id)]);
      await prisma.goal.update({ data: { status: "paused" }, where: { id: restored } });
      await prisma.goal.update({ data: { dailyMinutes: 20 }, where: { id: newest } });

      await expect(confirm([cardGoal(card.id)])).resolves.toStrictEqual([newest]);
    });

    it("makes one goal when two confirms arrive at once", async () => {
      const user = await userFixture();
      const card = await onboardingDraftFixture({ userId: user.id });
      mockSession(user.id);

      const [first, second] = await Promise.all([
        confirm([cardGoal(card.id)]),
        confirm([cardGoal(card.id)]),
      ]);

      expect(first).toHaveLength(1);
      expect(second).toStrictEqual(first);
      await expect(prisma.goal.count({ where: { userId: user.id } })).resolves.toBe(1);
    });

    it("returns each of a card's goals in its place", async () => {
      const user = await userFixture();
      const card = await onboardingDraftFixture({ userId: user.id });
      mockSession(user.id);
      const goals = [cardGoal(card.id, "Learn chess"), cardGoal(card.id, "Learn go")];

      const first = await confirm(goals);
      const again = await confirm(goals);

      expect(first).toHaveLength(2);
      expect(again).toStrictEqual(first);
      await expect(prisma.goal.count({ where: { userId: user.id } })).resolves.toBe(2);
    });

    it("starts a goal waiting on the card as a new goal", async () => {
      const user = await userFixture();
      const card = await onboardingDraftFixture({ userId: user.id });
      mockSession(user.id);

      const [first] = await confirm([cardGoal(card.id, "Learn chess")]);

      const waiting = await confirm([
        {
          ...cardGoal(card.id, "Learn go"),
          details: { onboardingId: card.id, onboardingPlace: 1 },
        },
      ]);

      expect(waiting).toStrictEqual([expect.not.stringMatching(first ?? "")]);
      await expect(prisma.goal.count({ where: { userId: user.id } })).resolves.toBe(2);
    });

    it("starts the card's goal again once the learner archived it", async () => {
      const user = await userFixture();
      const card = await onboardingDraftFixture({ userId: user.id });
      mockSession(user.id);

      const [archived] = await confirm([cardGoal(card.id)]);
      await prisma.goal.update({ data: { status: "archived" }, where: { id: archived } });

      const again = await confirm([cardGoal(card.id)]);

      expect(again).toStrictEqual([expect.not.stringMatching(archived ?? "")]);
    });

    it("returns the exam goal a card's language goal moved to", async () => {
      const user = await userFixture();
      const card = await onboardingDraftFixture({ userId: user.id });
      mockSession(user.id);

      const english: GoalDraft = {
        details: { onboardingId: card.id, reason: "vou fazer o IELTS em março" },
        kind: "language",
        language: "pt",
        prompt: "Aprender inglês",
        targetLanguage: "en",
        title: "Aprender inglês",
      };

      const [languageGoal] = await confirm([english]);
      const moved = await moveLanguageGoalToExam(languageGoal ?? "");
      const again = await confirm([english]);

      expect(again).toStrictEqual([moved.status === "moved" ? moved.goal.id : "not moved"]);
    });

    it("never returns a goal from another learner's card", async () => {
      const owner = await userFixture();
      const card = await onboardingDraftFixture({ userId: owner.id });
      mockSession(owner.id);
      const [ownersGoal] = await confirm([cardGoal(card.id)]);

      const other = await userFixture();
      mockSession(other.id);
      const forged = await confirm([cardGoal(card.id)]);

      expect(forged).toStrictEqual([expect.not.stringMatching(ownersGoal ?? "")]);
      await expect(prisma.goal.count({ where: { userId: other.id } })).resolves.toBe(1);
    });
  });

  it("refuses a date no card gave", async () => {
    const user = await userFixture();
    mockSession(user.id);

    const refusal = await createOnboardingGoals({
      dailyMinutes: 15,
      goals: [learnGoal({})],
      timeZone: dayAheadZone,
    }).catch((error: unknown) => (isInputRangeError(error) ? error.issues : error));

    expect(refusal).toMatchObject([{ params: { bound: "earliest" } }]);
  });
});
