import {
  type PlacementSkillItems,
  generatePlacementItems,
} from "@zoonk/ai/tasks/v2/items/placement-items";
import { findOrCreateGoalCourse } from "@zoonk/core/library/curriculum/find-or-create-course";
import {
  getGoalCourseFormat,
  setGoalPrimaryCourse,
} from "@zoonk/core/library/curriculum/goal-primary-course";
import { type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { createItems } from "@zoonk/core/library/items/create";
import {
  type PlacementItemFormat,
  type PlacementItemPick,
  type PlacementItemPicks,
  pickPlacementItemSkills,
} from "@zoonk/core/lookahead/placement-item-skills";
import {
  type PlanOutlineNeed,
  listPlanOutlineNeeds,
} from "@zoonk/core/lookahead/plan-outline-needs";
import { pickSpeculativeLessons } from "@zoonk/core/lookahead/speculative-lessons";
import { type GoalKind, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";
import { toPlacementItemBatches } from "../placement-item-batches";

/**
 * What placement writes for each skill it picked. One quick question is what day 1 and the first
 * week's sessions ask of a skill before moving on, and one typed question confirms a right quick
 * answer: a typed right answer takes a skill from 78% to 99% sure, past the 80% placement needs,
 * which a second multiple-choice one doesn't (93%, and only in a later session). A skill placement
 * can't ask again is left to lessons and reviews, whose answers count too.
 */
const PLACEMENT_ITEMS_PER_SKILL = { quick: 1, typed: 1 } as const;

type OwnLevel = Parameters<typeof pickSpeculativeLessons>[0]["ownLevel"];

type CourseProvenance = Parameters<typeof findOrCreateGoalCourse>[0]["provenance"];

/**
 * The Library course behind each course the skill graph names, found through identity search or
 * created, by the graph's course key. Courses come in the order the learner reaches them, and the
 * first becomes the goal's main course. It needs only the graph, so it runs while the skills are
 * found, and the plan knows each skill's course from the start.
 */
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
  /** The skill graph run that named the courses. */
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

/** The plan's first lessons, which the learner opens first and speculative work writes ahead. */
const OPENING_LESSONS = 4;

/**
 * The lessons of the plan's opening in order, `null` for a stand-in: until the outline of the
 * band that teaches a skill lands, its item stands in for the skill.
 */
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

/** The skill of the plan's first lesson: the band that teaches it is the one the learner waits on. */
export async function readPlanFirstSkillStep(goalId: string): Promise<string | null> {
  "use step";

  const first = await prisma.planItem.findFirst({
    orderBy: { position: "asc" },
    select: { skillId: true },
    where: { kind: "lesson", plan: { goalId }, status: "todo" },
  });

  return first?.skillId ?? null;
}

export async function pickSpeculativeLessonsStep(input: {
  goalId: string;
  ownLevel: OwnLevel;
}): Promise<string[][]> {
  "use step";

  return pickSpeculativeLessons(input);
}

/** The outlines an existing plan's stand-ins still need, by course and level band. */
export async function listPlanOutlineNeedsStep(goalId: string): Promise<PlanOutlineNeed[]> {
  "use step";

  return listPlanOutlineNeeds(goalId);
}

type WriteContext = { analytics?: ContentAnalytics; workflowRunId: string };

type PlacementQuickFormat = PlacementItemPicks["quickFormat"];

type PlacementProvenance = Awaited<ReturnType<typeof generatePlacementItems>>["provenance"];

export type PlacementItemsWritten = { failed: number; written: number };

/** Adds up what several writes stored: skills placement can ask, and skills that got nothing. */
function countPlacementItems(results: readonly PlacementItemsWritten[]): PlacementItemsWritten {
  return {
    failed: results.reduce((total, result) => total + result.failed, 0),
    written: results.reduce((total, result) => total + result.written, 0),
  };
}

/** One more try right away: the learner is waiting, so there's no backoff. */
async function withOneRetry<T>(write: () => Promise<T>): Promise<T> {
  const first = await safeAsync(write);
  return first.error ? write() : first.data;
}

/** Stores one skill's questions in one format; they join the shared item bank. */
async function storeSkillItems({
  format,
  items,
  provenance,
  skill,
}: {
  format: PlacementItemFormat;
  items: PlacementSkillItems["quick"];
  provenance: PlacementProvenance;
  skill: PlacementItemPick;
}): Promise<number> {
  const { exam } = skill;

  const { created } = await createItems({
    examBlueprintId: exam?.blueprintId ?? null,
    format,
    items,
    language: skill.language,
    optionCount: format === "multipleChoice" ? (exam?.optionCount ?? null) : null,
    provenance,
    skillId: skill.id,
  });

  return created.length;
}

/** Whether placement can now ask the skill: its quick question passed the checks and was stored. */
async function storePlacementItems({
  items,
  provenance,
  quickFormat,
  skill,
}: {
  items: PlacementSkillItems;
  provenance: PlacementProvenance;
  quickFormat: PlacementQuickFormat;
  skill: PlacementItemPick;
}): Promise<boolean> {
  const [quick] = await Promise.all([
    storeSkillItems({ format: quickFormat, items: items.quick, provenance, skill }),
    skill.needsTyped
      ? storeSkillItems({ format: "typed", items: items.typed, provenance, skill })
      : null,
  ]);

  return quick > 0;
}

/**
 * Writes placement's questions for a batch of skills in one call at the priority tier (placement
 * waits on them), retried once right away, then stores each skill's. A skill counts as written
 * once placement can ask it; a failed call counts every skill in it as failed.
 */
async function writePlacementBatch({
  analytics,
  quickCount,
  quickFormat,
  skills,
  workflowRunId,
}: WriteContext & {
  quickCount: number;
  quickFormat: PlacementQuickFormat;
  skills: PlacementItemPick[];
}): Promise<PlacementItemsWritten> {
  const [first] = skills;

  if (!first) {
    return { failed: 0, written: 0 };
  }

  const generated = await safeAsync(() =>
    withOneRetry(() =>
      generatePlacementItems({
        analytics: toContentAnalytics({ analytics, scope: first, workflowRunId }),
        examFormat: first.exam,
        language: first.language,
        quickCount,
        quickFormat,
        serviceTier: "priority",
        skills: skills.map((skill) => ({
          description: skill.description,
          level: skill.level ?? "beginner",
          name: skill.name,
        })),
        typedCount: first.needsTyped ? PLACEMENT_ITEMS_PER_SKILL.typed : 0,
      }),
    ),
  );

  if (generated.error) {
    return { failed: skills.length, written: 0 };
  }

  const { data, provenance } = generated.data;

  const stored = await Promise.allSettled(
    skills.map((skill, index) =>
      storePlacementItems({
        items: data.skills[index] ?? { quick: [], typed: [] },
        provenance,
        quickFormat,
        skill,
      }),
    ),
  );

  const written = stored.filter((result) => result.status === "fulfilled" && result.value).length;
  return { failed: skills.length - written, written };
}

/**
 * Writes placement's questions for the skills the run picked from the skill graph once they're in
 * the Library (`skillIds`), or for the plan's picks when the plan came with the goal (or its exam's
 * blueprint came after its first questions): a quick question in the goal's quick format and a
 * typed one for each skill that has none placement can ask, a few skills per model call, all calls
 * at once, each retried once, so one failing never holds up the others. Each call's questions are
 * stored as soon as it's done, so placement can ask them while the others are written. What still
 * fails is counted, not thrown: placement stops waiting for it. A chapter's test-out asks a few
 * multiple-choice questions only, so it passes that format (`formats`) and how many
 * (`quickCount`).
 */
export async function preparePlacementItemsStep({
  analytics,
  formats,
  goalId,
  quickCount = PLACEMENT_ITEMS_PER_SKILL.quick,
  skillIds,
  workflowRunId,
}: WriteContext & {
  formats?: readonly PlacementItemFormat[];
  goalId: string;
  quickCount?: number;
  skillIds?: string[];
}): Promise<PlacementItemsWritten> {
  "use step";

  const { quickFormat, skills } = await pickPlacementItemSkills({ formats, goalId, skillIds });

  const results = await Promise.all(
    toPlacementItemBatches({ quickCount, skills }).map((batch) =>
      writePlacementBatch({ analytics, quickCount, quickFormat, skills: batch, workflowRunId }),
    ),
  );

  return countPlacementItems(results);
}
