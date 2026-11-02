import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { describe, expect, it } from "vitest";
import { mockAccountSession, mockGuestSession } from "../../_test-utils/mock-session";
import { updateGoal } from "../../goals/update-goal";
import { getLearnerSummary } from "../../learner/summary/get-learner-summary";
import { createOnboardingGoals } from "./create-onboarding-goals";
import { getOnboarding } from "./get-onboarding";
import { type OnboardingDraftView } from "./onboarding-contract";
import { startGoalUnderstanding } from "./start-goal-understanding";

async function useLearner({ plus = false } = {}) {
  const user = await userFixture();

  if (plus) {
    await subscribe(user.id);
  }

  mockAccountSession({ user });
  return user;
}

function subscribe(userId: string) {
  return prisma.subscription.create({
    data: { plan: "plus", provider: "zoonk", referenceId: userId, status: "active" },
  });
}

type CardGoal = { subject: string; targetDate?: string; title: string };

const STATISTICS: CardGoal = { subject: "Statistics", title: "Learn statistics" };

async function readCard(userId: string, others: CardGoal[] = [STATISTICS]) {
  const words = `learn english and more, 30 min a day ${randomUUID()}`;

  await goalUnderstandingFixture({
    goal: words,
    result: {
      dailyMinutes: 30,
      followUps: [],
      goals: [
        {
          kind: "language",
          ownLevel: "basic",
          subject: "English",
          targetLanguage: "en",
          title: "Learn English",
        },
        ...others.map((goal) => ({ ...goal, kind: "learn" as const, ownLevel: "none" as const })),
      ],
      route: "goals",
    },
    userId,
  });

  const started = await startGoalUnderstanding({ goal: words, language: "en", timeZone: "UTC" });

  if (started.status !== "understood") {
    throw new Error(`Words weren't understood: ${started.status}`);
  }

  return started.draft;
}

/** What every client sends on "Looks right": the card's goals the plan follows. */
function confirm(draft: OnboardingDraftView) {
  const understanding = draft.understanding;

  if (understanding?.status !== "goals") {
    throw new Error("Expected goals");
  }

  const goals = understanding.goals
    .slice(0, draft.activeGoalLimit ?? undefined)
    .map((goal) => goal.draft);

  return createOnboardingGoals({ dailyMinutes: understanding.schedule.dailyMinutes, goals });
}

async function readWaitingGoals() {
  const summary = await getLearnerSummary();
  return summary?.waitingGoals ?? [];
}

describe("goals typed together beyond the goals a plan follows at once", () => {
  it("starts a free learner's first goal with the whole day and the other once they have Plus", async () => {
    const user = await useLearner();
    const draft = await readCard(user.id);

    expect(draft.activeGoalLimit).toBe(1);

    const created = await confirm(draft);

    expect(created).toMatchObject({
      goals: [{ dailyMinutes: 30, title: "Learn English" }],
      refused: [],
      status: "created",
    });

    await expect(readWaitingGoals()).resolves.toMatchObject([
      { input: { goals: [{ title: "Learn statistics" }] }, locked: true },
    ]);

    await subscribe(user.id);
    const [waiting] = await readWaitingGoals();

    expect(waiting?.locked).toBe(false);

    const added = await createOnboardingGoals(waiting?.input ?? { dailyMinutes: 0, goals: [] });
    const [statistics] = added.status === "created" ? added.goals : [];
    const first = created.status === "created" ? created.goals[0] : undefined;

    expect(statistics?.details.onboardingId).toBe(draft.id);
    await expect(readWaitingGoals()).resolves.toStrictEqual([]);

    const setup = await getOnboarding({ goalId: statistics?.id ?? "" });

    expect(setup).toMatchObject({
      onboarding: {
        goalIds: [first?.id, statistics?.id],
        steps: expect.arrayContaining(["schedule"]),
      },
      status: "ready",
    });
  });

  it("keeps each waiting goal in its place when a later one starts first", async () => {
    const user = await useLearner();
    const chemistry = { subject: "Chemistry", title: "Learn chemistry" };
    await confirm(await readCard(user.id, [STATISTICS, chemistry]));
    await subscribe(user.id);

    const waiting = await readWaitingGoals();

    expect(waiting.map((goal) => goal.input.goals[0]?.title)).toStrictEqual([
      STATISTICS.title,
      chemistry.title,
    ]);

    await createOnboardingGoals(waiting[1]?.input ?? { dailyMinutes: 0, goals: [] });

    await expect(readWaitingGoals()).resolves.toMatchObject([
      { input: { goals: [{ title: STATISTICS.title }] } },
    ]);
  });

  it("leaves a date that has passed to setup, so the goal still starts", async () => {
    const user = await useLearner({ plus: true });
    const yesterday = new Date(Date.now() - MS_PER_DAY).toISOString().slice(0, 10);
    const draft = await readCard(user.id, [{ ...STATISTICS, targetDate: yesterday }]);
    const understanding = draft.understanding?.status === "goals" ? draft.understanding : null;

    await createOnboardingGoals({
      dailyMinutes: 30,
      goals: understanding?.goals.slice(0, 1).map((goal) => goal.draft) ?? [],
    });

    const [waiting] = await readWaitingGoals();
    expect(waiting?.input.goals[0]?.targetDate).toBeUndefined();

    await expect(
      createOnboardingGoals(waiting?.input ?? { dailyMinutes: 0, goals: [] }),
    ).resolves.toMatchObject({ goals: [{ targetDate: null, title: STATISTICS.title }] });
  });

  it("drops a waiting goal once the learner starts over", async () => {
    const user = await useLearner();
    const created = await confirm(await readCard(user.id));
    const goalId = created.status === "created" ? (created.goals[0]?.id ?? "") : "";

    await updateGoal({ goalId, input: { status: "archived" } });

    await expect(readWaitingGoals()).resolves.toStrictEqual([]);
  });

  it("follows one goal for a guest", async () => {
    const user = await userFixture();
    mockGuestSession(user.id);

    await expect(readCard(user.id)).resolves.toMatchObject({ activeGoalLimit: 1 });
  });

  it("starts every goal for a Plus learner, sharing the day", async () => {
    const user = await useLearner({ plus: true });
    const draft = await readCard(user.id);

    expect(draft.activeGoalLimit).toBeNull();

    const created = await confirm(draft);
    const goals = created.status === "created" ? created.goals : [];

    expect(goals.map((goal) => goal.title)).toStrictEqual(["Learn English", "Learn statistics"]);
    await expect(readWaitingGoals()).resolves.toStrictEqual([]);
  });
});
