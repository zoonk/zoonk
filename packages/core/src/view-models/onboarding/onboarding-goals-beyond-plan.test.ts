import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { describe, expect, it } from "vitest";
import { mockAccountSession, mockGuestSession } from "../../_test-utils/mock-session";
import { updateGoal } from "../../goals/update-goal";
import { getLearnerSummary } from "../../learner/summary/get-learner-summary";
import { parseStoredUnderstanding } from "./_utils/onboarding-draft";
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

const CHEMISTRY: CardGoal = { subject: "Chemistry", title: "Learn chemistry" };

function follow(userId: string, count: number) {
  return Promise.all(Array.from({ length: count }, () => goalFixture({ userId })));
}

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
    .slice(0, draft.activeGoalsLeft ?? undefined)
    .map((goal) => goal.draft);

  return createOnboardingGoals({ dailyMinutes: understanding.schedule.dailyMinutes, goals });
}

async function readWaitingGoals() {
  const summary = await getLearnerSummary();
  return summary?.waitingGoals ?? [];
}

describe("goals typed together beyond the goals a plan follows at once", () => {
  it("starts the goals a free learner has room for, sharing the day, and the rest once a slot frees", async () => {
    const user = await useLearner();
    const [followed] = await follow(user.id, 1);
    const draft = await readCard(user.id, [STATISTICS, CHEMISTRY]);

    expect(draft.activeGoalsLeft).toBe(2);

    const created = await confirm(draft);

    expect(created).toMatchObject({
      goals: [
        { dailyMinutes: 20, title: "Learn English" },
        { dailyMinutes: 10, title: STATISTICS.title },
      ],
      refused: [],
      status: "created",
    });

    const stored = await prisma.onboardingDraft.findUniqueOrThrow({ where: { id: draft.id } });
    const understood = parseStoredUnderstanding(stored.understanding);

    if (understood?.status !== "goals") {
      throw new Error("Expected a stored card");
    }

    const oldUnderstanding = {
      ...understood,
      goals: understood.goals.map((goal) => ({
        ...goal,
        draft: Object.fromEntries(
          Object.entries(goal.draft).filter(([key]) => key !== "displayName"),
        ),
      })),
    };

    await prisma.onboardingDraft.update({
      data: { understanding: oldUnderstanding },
      where: { id: draft.id },
    });

    await expect(readWaitingGoals()).resolves.toMatchObject([
      {
        displayName: "Chemistry",
        input: { goals: [{ displayName: "Chemistry", title: CHEMISTRY.title }] },
        locked: true,
      },
    ]);

    await updateGoal({ goalId: followed?.id ?? "", input: { status: "paused" } });
    const [waiting] = await readWaitingGoals();

    expect(waiting?.locked).toBe(false);

    const added = await createOnboardingGoals(waiting?.input ?? { dailyMinutes: 0, goals: [] });
    const [chemistry] = added.status === "created" ? added.goals : [];
    const startedIds = created.status === "created" ? created.goals.map((goal) => goal.id) : [];

    expect(chemistry?.details.onboardingId).toBe(draft.id);
    await expect(readWaitingGoals()).resolves.toStrictEqual([]);

    const setup = await getOnboarding({ goalId: chemistry?.id ?? "" });

    expect(setup).toMatchObject({
      onboarding: {
        goalIds: [...startedIds, chemistry?.id],
        steps: expect.arrayContaining(["schedule"]),
      },
      status: "ready",
    });
  });

  it("starts a goal waiting on Free once the learner has Plus", async () => {
    const user = await useLearner();
    await follow(user.id, 2);
    await confirm(await readCard(user.id));

    await expect(readWaitingGoals()).resolves.toMatchObject([
      { input: { goals: [{ title: STATISTICS.title }] }, locked: true },
    ]);

    await subscribe(user.id);

    await expect(readWaitingGoals()).resolves.toMatchObject([{ locked: false }]);
  });

  it("keeps each waiting goal in its place when a later one starts first", async () => {
    const user = await useLearner();
    await follow(user.id, 2);
    await confirm(await readCard(user.id, [STATISTICS, CHEMISTRY]));
    await subscribe(user.id);

    const waiting = await readWaitingGoals();

    expect(waiting.map((goal) => goal.input.goals[0]?.title)).toStrictEqual([
      STATISTICS.title,
      CHEMISTRY.title,
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
    await follow(user.id, 2);
    const created = await confirm(await readCard(user.id));
    const goalId = created.status === "created" ? (created.goals[0]?.id ?? "") : "";

    await expect(readWaitingGoals()).resolves.toHaveLength(1);

    await updateGoal({ goalId, input: { status: "archived" } });

    await expect(readWaitingGoals()).resolves.toStrictEqual([]);
  });

  it("follows one goal for a guest", async () => {
    const user = await userFixture();
    mockGuestSession(user.id);

    await expect(readCard(user.id)).resolves.toMatchObject({ activeGoalsLeft: 1 });
  });

  it("starts every goal for a Plus learner, sharing the day", async () => {
    const user = await useLearner({ plus: true });
    await follow(user.id, 3);
    const draft = await readCard(user.id);

    expect(draft.activeGoalsLeft).toBeNull();

    const created = await confirm(draft);
    const goals = created.status === "created" ? created.goals : [];

    expect(goals.map((goal) => goal.title)).toStrictEqual(["Learn English", "Learn statistics"]);
    await expect(readWaitingGoals()).resolves.toStrictEqual([]);
  });
});
