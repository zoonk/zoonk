import { findOrCreateGoalCourse } from "@zoonk/core/library/curriculum/find-or-create-course";
import {
  getGoalCourseFormat,
  setGoalPrimaryCourse,
} from "@zoonk/core/library/curriculum/goal-primary-course";
import { type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { type LearnerLookahead, getGoalLookahead } from "@zoonk/core/lookahead/learner-lookahead";
import { endLessonsAsk } from "@zoonk/core/lookahead/lessons-ask";
import {
  type PlanOutlineNeed,
  listPlanOutlineNeeds,
  listPlanSkillIdsWithin,
  listSoonStandInCourseIds,
} from "@zoonk/core/lookahead/plan-outline-needs";
import {
  type PlanGenerationManifest,
  createPlanGenerationManifest,
  pickPlanStartToWrite,
  pickSpeculativeLessons,
} from "@zoonk/core/lookahead/speculative-lessons";
import { type GoalKind, prisma } from "@zoonk/db";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";
import { catchPlanConflict } from "../../_shared/plan-conflict-outcome";
import { type PlanStepOutcome } from "../../_shared/plan-conflict-retry";

type OwnLevel = Parameters<typeof pickSpeculativeLessons>[0]["ownLevel"];

type CourseProvenance = Parameters<typeof findOrCreateGoalCourse>[0]["provenance"];

export async function findGoalCoursesStep({
  analytics,
  courses,
  goal,
  provenance,
  scope,
  workflowRunId,
}: {
  analytics?: ContentAnalytics;
  courses: { key: string; title: string }[];
  goal: { id: string; kind: GoalKind };
  provenance: CourseProvenance;
  scope: CurriculumScope;
  workflowRunId: string;
}): Promise<Record<string, string>> {
  "use step";

  const format = getGoalCourseFormat({ kind: goal.kind, ownerId: scope.ownerId });
  const context = toContentAnalytics({ analytics, scope, workflowRunId });

  const found = await Promise.all(
    courses.map(async (need) => {
      const { course } = await withAiRetry(() =>
        findOrCreateGoalCourse({
          analytics: context,
          format,
          provenance,
          scope,
          title: need.title,
        }),
      );

      return [need.key, course.id] as const;
    }),
  );

  const [first] = found;

  if (first) {
    await setGoalPrimaryCourse({ courseId: first[1], goalId: goal.id });
  }

  return Object.fromEntries(found);
}

const OPENING_LESSONS = 4;

/** `null` is a stand-in for a skill whose band isn't outlined yet. */
export async function readPlanOpeningStep(goalId: string): Promise<(string | null)[]> {
  "use step";

  const opening = await prisma.planItem.findMany({
    orderBy: { position: "asc" },
    select: { lessonId: true },
    take: OPENING_LESSONS,
    where: { kind: "lesson", plan: { goalId }, status: "todo" },
  });

  return opening.map((item) => item.lessonId);
}

export async function readPlanFirstSkillStep(goalId: string): Promise<string | null> {
  "use step";

  const first = await prisma.planItem.findFirst({
    orderBy: { position: "asc" },
    select: { skillId: true },
    where: { kind: "lesson", plan: { goalId }, status: "todo" },
  });

  return first?.skillId ?? null;
}

export async function pickPlanStartToWriteStep(goalId: string): Promise<string | null> {
  "use step";

  return pickPlanStartToWrite(goalId);
}

export async function pickSpeculativeLessonsStep(input: {
  count: number;
  goalId: string;
  ownLevel: OwnLevel;
}): Promise<string[][]> {
  "use step";

  return pickSpeculativeLessons(input);
}

export async function createGoalGenerationManifestStep(input: {
  goalId: string;
  lessonIds: string[];
}): Promise<PlanStepOutcome<PlanGenerationManifest | null>> {
  "use step";

  return catchPlanConflict(() => createPlanGenerationManifest(input));
}

export async function listPlanOutlineNeedsStep(input: {
  days: number;
  goalId: string;
}): Promise<PlanOutlineNeed[]> {
  "use step";

  return listPlanOutlineNeeds(input);
}

export async function endLessonsAskStep(input: {
  askedAt: number;
  goalId: string;
  startedCourseIds: string[];
}): Promise<void> {
  "use step";

  await endLessonsAsk(input);
}

export async function listSoonStandInCourseIdsStep(input: {
  days: number;
  goalId: string;
}): Promise<string[]> {
  "use step";

  return listSoonStandInCourseIds(input);
}

export async function readGoalLookaheadStep(goalId: string): Promise<LearnerLookahead> {
  "use step";

  return getGoalLookahead(goalId);
}

export async function listPlanSkillIdsWithinStep(input: {
  days: number;
  goalId: string;
}): Promise<string[]> {
  "use step";

  return listPlanSkillIdsWithin(input);
}
