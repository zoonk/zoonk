import { type Goal, type PlanItem } from "@zoonk/db";
import { goalFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { studySessionPlanFixture } from "@zoonk/testing/fixtures/study-sessions";

/** Avoid accidental Monday fresh-start rules in session fixtures. */
export const SESSION_NOW = new Date("2026-09-30T12:00:00Z");
export const SESSION_TODAY = new Date("2026-09-30T00:00:00Z");
export const DAY_MS = 86_400_000;

const LAST_REVIEW_DAYS_AGO = 4;

export function daysAgo(days: number): Date {
  return new Date(SESSION_NOW.getTime() - days * DAY_MS);
}

export async function sessionGoalFixture({
  goal,
  itemsPerSkill = 3,
  lessons = 3,
  userId,
}: {
  goal?: Partial<Omit<Goal, "details">>;
  itemsPerSkill?: number;
  lessons?: number;
  userId: string;
}) {
  const created = await goalFixture({
    dailyMinutes: 45,
    // Decline placement without aging the goal, which would also expire a free exam trial.
    details: { placementDeclined: true },
    timezone: "UTC",
    userId,
    ...goal,
  });

  return studySessionPlanFixture({ goal: created, itemsPerSkill, lessons });
}

export function dueSkillFixture({
  due = daysAgo(1),
  skillId,
  userId,
}: {
  due?: Date;
  skillId: string;
  userId: string;
}) {
  return learnerSkillFixture({
    difficulty: 5,
    due,
    lastReviewedAt: daysAgo(LAST_REVIEW_DAYS_AGO),
    reps: 2,
    skillId,
    stability: 3,
    state: "learning",
    userId,
  });
}

/** Omitted date uses the fixture's day; explicit null means unscheduled. */
export function checkpointItemFixture({
  kind,
  phase = 0,
  planId,
  position,
  scheduledFor = SESSION_TODAY,
}: {
  kind: PlanItem["kind"];
  phase?: number;
  planId: string;
  position: number;
  scheduledFor?: Date | null;
}) {
  return planItemFixture({
    kind,
    phase,
    planId,
    position,
    scheduledFor,
    titleSnapshot: `Test ${kind}`,
  });
}

export const NET_SCORED_EXAM_STRUCTURE = {
  formats: [],
  mock: {
    adaptive: false,
    citations: [{ passage: "Each wrong answer cancels a right one.", sourceId: "source" }],
    order: null,
    scoring: { description: "Wrong answers cancel right ones", method: "wrongCancelsRight" },
    sections: [],
    timeLimitMinutes: 180,
    totalQuestions: 120,
  },
  rules: [],
  subjects: [],
};

export function statementContent(isTrue: boolean) {
  return {
    context: null,
    isTrue,
    misconception: null,
    reason: "Because of the rule.",
    statement: `A statement ${crypto.randomUUID()}`,
  };
}
