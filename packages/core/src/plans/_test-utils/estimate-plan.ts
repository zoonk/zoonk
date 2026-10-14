import { type GoalKind, prisma } from "@zoonk/db";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { mockSession } from "../../_test-utils/mock-session";
import { loadTodayPlanChange } from "../_utils/today-plan-change";
import { createGoalPlan } from "../create-goal-plan";
import { decidePlanChange } from "../decide-plan-change";
import { planLibraryFixture, unplannedGoalFixture } from "./plan-library";

const DAY_MS = 86_400_000;
const STAND_IN_LESSONS = 4;
const PARTIAL_SKILL_LESSONS = 10;
const DEFAULT_WRITTEN_LESSONS = 8;
const WRITTEN_POSITION = 5000;
const PHASES = ["Phase 1", "Phase 2", "Phase 3", "Phase 4"];

function sizeSkill({
  index,
  lessons,
  partialStandIns,
  standIns,
}: {
  index: number;
  lessons: number;
  partialStandIns: readonly number[];
  standIns: readonly number[];
}) {
  if (partialStandIns.includes(index)) {
    return { lessons: STAND_IN_LESSONS, size: PARTIAL_SKILL_LESSONS };
  }

  return standIns.includes(index)
    ? { lessons: 0, size: STAND_IN_LESSONS }
    : { lessons, size: lessons };
}

/**
 * A goal `days` away whose skills each have `lessons` Library lessons (those in `standIns` none, so
 * the plan holds a stand-in of 4 for each), planned at the pace lessons estimate, with no one's
 * lessons read yet.
 */
export async function pacedPlanFixture({
  dailyMinutes,
  days,
  lessons,
  skills,
  standIns = [],
  partialStandIns = [],
  own = false,
  kind = "learn",
  fullCourse = false,
}: {
  dailyMinutes: number;
  days: number | null;
  lessons: number;
  skills: number;
  /** The skills (by index) the Library hasn't written lessons for yet. */
  standIns?: readonly number[];
  /** Four written lessons, with six of the skill's ten lessons still estimated. */
  partialStandIns?: readonly number[];
  own?: boolean;
  kind?: GoalKind;
  fullCourse?: boolean;
}) {
  const user = await userFixture();

  const library = await planLibraryFixture({
    phases: PHASES,
    skills: Array.from({ length: skills }, (_, index) => ({
      area: "Stocks",
      ...sizeSkill({ index, lessons, partialStandIns, standIns }),
      phase: Math.floor((index * PHASES.length) / skills),
    })),
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes,
    details: { placementDeclined: true },
    kind,
    settings: {
      startDate: "2020-09-29",
      ...(own ? { pace: { factor: 1, source: "own" } } : {}),
      ...(fullCourse ? { fullCourse: true } : {}),
    },
    targetDate: days === null ? null : new Date(Date.parse("2020-09-29T00:00:00Z") + days * DAY_MS),
    timezone: "UTC",
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  return { goal, library, plan, user };
}

/**
 * The learner took `seconds` on each of the plan's lessons, long ago enough that no one else's pace
 * reads it: the next session's refresh estimates from their own lessons.
 */
export async function studyEveryLesson({
  planId,
  seconds,
  userId,
}: {
  planId: string;
  seconds: number;
  userId: string;
}) {
  const items = await prisma.planItem.findMany({
    where: { kind: "lesson", lessonId: { not: null }, planId },
  });

  await Promise.all(
    items.map((item) =>
      learningEventFixture({
        contentIds: { lessonId: item.lessonId },
        endedAt: new Date("2001-01-01T12:00:00Z"),
        seconds,
        userId,
      }),
    ),
  );
}

/** The Library writes eight lessons for each of `skills`, in the chapter they're planned in. */
export async function writeLessons({
  chapterId,
  estimatedMinutes,
  lessonCount = DEFAULT_WRITTEN_LESSONS,
  skills,
}: {
  chapterId: string;
  estimatedMinutes: number;
  lessonCount?: number;
  skills: readonly { id: string }[];
}) {
  await Promise.all(
    skills.flatMap((skill, skillIndex) =>
      Array.from({ length: lessonCount }, async (_, lessonIndex) => {
        const lesson = await libraryLessonFixture({
          estimatedMinutes,
          homeChapterId: chapterId,
          title: `Written ${skill.id} ${lessonIndex}`,
        });

        await Promise.all([
          chapterLessonFixture({
            chapterId,
            lessonId: lesson.id,
            position: WRITTEN_POSITION + skillIndex * 100 + lessonIndex,
          }),
          lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
        ]);
      }),
    ),
  );
}

/** Today's proposals, answered "Not now", so Today brings up the change of the last day. */
export async function declineProposals({ goalId, planId }: { goalId: string; planId: string }) {
  const proposals = await prisma.planChange.findMany({ where: { planId, status: "proposed" } });

  await Promise.all(
    proposals.map((proposal) =>
      decidePlanChange({ changeId: proposal.id, goalId, input: { status: "declined" } }),
    ),
  );
}

export async function readTodayChange(goalId: string) {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
  return loadTodayPlanChange({ goal, now: new Date() });
}
