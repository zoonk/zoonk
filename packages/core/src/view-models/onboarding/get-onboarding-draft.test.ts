import { randomUUID } from "node:crypto";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { onboardingDraftFixture } from "@zoonk/testing/fixtures/onboarding-drafts";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockGuestSession, mockSession } from "../../_test-utils/mock-session";
import { getTargetDateBounds } from "../../plans/target-date-range";
import { getLearnerToday } from "./_utils/understanding-view";
import { getOnboardingDraft } from "./get-onboarding-draft";

function learnGoal({ targetDate, title }: { targetDate: string; title: string }) {
  return {
    draft: {
      details: { purpose: "overview" },
      kind: "learn",
      language: "en",
      prompt: title,
      targetDate,
      title,
    },
    examDates: [],
  };
}

describe(getOnboardingDraft, () => {
  it("needs a session", async () => {
    mockSession(null);

    await expect(getOnboardingDraft({ draftId: randomUUID() })).resolves.toStrictEqual({
      status: "unauthorized",
    });
  });

  it("shows a draft being read with the run to follow", async () => {
    const user = await userFixture();
    mockGuestSession(user.id);

    const draft = await onboardingDraftFixture({
      prompt: "pass the bar exam",
      runId: "understanding-run",
      status: "understanding",
      userId: user.id,
    });

    await expect(getOnboardingDraft({ draftId: draft.id })).resolves.toStrictEqual({
      draft: {
        activeGoalLimit: 1,
        generationId: "understanding-run",
        goalId: null,
        id: draft.id,
        prompt: "pass the bar exam",
        status: "understanding",
        timeZone: "UTC",
        understanding: null,
      },
      status: "ready",
    });
  });

  it("shows the card once understood, and the goal confirmed from it", async () => {
    const user = await userFixture();
    mockSession(user.id);
    const draft = await onboardingDraftFixture({ userId: user.id });

    const [archived, goal] = await Promise.all([
      goalFixture({ details: { onboardingId: draft.id }, status: "archived", userId: user.id }),
      goalFixture({ details: { onboardingId: draft.id }, userId: user.id }),
      goalFixture({ details: { onboardingId: randomUUID() }, userId: user.id }),
    ]);

    const result = await getOnboardingDraft({ draftId: draft.id });
    const understanding = result.status === "ready" ? result.draft.understanding : null;

    expect(result.status === "ready" && result.draft.goalId).toBe(goal.id);
    expect(result.status === "ready" && result.draft.goalId).not.toBe(archived.id);
    expect(understanding?.status).toBe("goals");
  });

  it("shows a card date a new goal can't have as no date", async () => {
    const timeZone = "Pacific/Kiritimati";
    const user = await userFixture();
    mockSession(user.id);

    const today = getLearnerToday(timeZone);
    const { max, min: tomorrow } = getTargetDateBounds(today);
    const pastMax = getTargetDateBounds(tomorrow).max;

    const draft = await onboardingDraftFixture({
      timeZone,
      understanding: {
        goals: [
          learnGoal({ targetDate: today, title: "Learn chess" }),
          learnGoal({ targetDate: tomorrow, title: "Learn Go" }),
          learnGoal({ targetDate: max, title: "Learn bridge" }),
          learnGoal({ targetDate: pastMax, title: "Learn poker" }),
        ],
        schedule: { dailyMinutes: 15, studyDays: null, studyTime: null, studyTimeNote: null },
        status: "goals",
      },
      userId: user.id,
    });

    const result = await getOnboardingDraft({ draftId: draft.id });
    const understanding = result.status === "ready" ? result.draft.understanding : null;
    const goals = understanding?.status === "goals" ? understanding.goals : [];

    expect(goals.map((goal) => goal.draft.targetDate)).toStrictEqual([
      undefined,
      tomorrow,
      max,
      undefined,
    ]);
  });

  it("reads another learner's draft, or a malformed id, as missing", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);
    const draft = await onboardingDraftFixture({ userId: owner.id });
    mockSession(other.id);

    await expect(getOnboardingDraft({ draftId: draft.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(getOnboardingDraft({ draftId: "not-a-draft" })).resolves.toStrictEqual({
      status: "notFound",
    });
  });

  it("reads again a card this version can't read, like a failed one", async () => {
    const user = await userFixture();
    mockSession(user.id);

    const draft = await onboardingDraftFixture({
      understanding: { goals: [], status: "goals" },
      userId: user.id,
    });

    const result = await getOnboardingDraft({ draftId: draft.id });

    expect(result.status === "ready" && result.draft).toMatchObject({
      status: "failed",
      understanding: null,
    });
  });
});
