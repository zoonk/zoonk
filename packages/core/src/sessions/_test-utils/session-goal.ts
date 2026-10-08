import { type Goal, type PlanItem } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";

/** A Wednesday, so no session in these tests is a Monday fresh start by accident. */
export const SESSION_NOW = new Date("2026-09-30T12:00:00Z");
export const SESSION_TODAY = new Date("2026-09-30T00:00:00Z");
export const DAY_MS = 86_400_000;

/** Due skills were last reviewed a few days ago, so reviewing today is a later-day recall. */
const LAST_REVIEW_DAYS_AGO = 4;

export function daysAgo(days: number): Date {
  return new Date(SESSION_NOW.getTime() - days * DAY_MS);
}

/**
 * A goal whose plan has one lesson per skill (each lesson teaching its skill, with a can-do line)
 * and `itemsPerSkill` choice questions per skill, all in phase 0 unless `extraItems` add more.
 */
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
    // Placement ended with the learner starting from scratch, so sessions don't open with first-week
    // placement questions unless a test asks. (Aging the goal instead would end a free exam trial.)
    details: { placementDeclined: true },
    timezone: "UTC",
    userId,
    ...goal,
  });

  const plan = await planFixture({
    goalId: created.id,
    phases: [{ name: "Basics" }, { name: "Practice" }],
  });

  const skills = await Promise.all(
    Array.from({ length: lessons }, (_, index) => skillFixture({ name: `Skill ${index + 1}` })),
  );

  const lessonRows = await Promise.all(
    skills.map((_, index) =>
      libraryLessonFixture({ canDo: `You'll do thing ${index + 1}`, title: `Lesson ${index + 1}` }),
    ),
  );

  const [planItems, items] = await Promise.all([
    Promise.all(
      lessonRows.map((lesson, position) =>
        planItemFixture({
          kind: "lesson",
          lessonId: lesson.id,
          phase: 0,
          planId: plan.id,
          position,
          titleSnapshot: lesson.title,
        }),
      ),
    ),
    Promise.all(
      skills.flatMap((skill) =>
        Array.from({ length: itemsPerSkill }, () =>
          itemFixture({ content: choiceItemContent(), skillId: skill.id }),
        ),
      ),
    ),
    Promise.all(
      lessonRows.map((lesson, index) =>
        lessonSkillFixture({ lessonId: lesson.id, skillId: skills[index]?.id ?? "" }),
      ),
    ),
  ]);

  return { goal: created, items, lessons: lessonRows, plan, planItems, skills };
}

/** A skill the learner studied earlier and FSRS says is due by `due`. */
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

/** Adds a plan item after the plan's lessons (a boss, mock or weekly checkpoint). */
export function checkpointItemFixture({
  kind,
  phase = 0,
  planId,
  position,
  scheduledFor = null,
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

/** A Cebraspe-style exam: a wrong answer cancels a right one, so capsules and practice score net. */
export const NET_SCORED_EXAM_STRUCTURE = {
  formats: [],
  mock: {
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

/** A true-or-false statement's content, true or false as asked. */
export function statementContent(isTrue: boolean) {
  return {
    context: null,
    isTrue,
    misconception: null,
    reason: "Because of the rule.",
    statement: `A statement ${crypto.randomUUID()}`,
  };
}
