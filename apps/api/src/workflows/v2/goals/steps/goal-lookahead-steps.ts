import { type CallWait, chooseServiceTier } from "@zoonk/ai/provider-options";
import {
  type PlacementSkillItems,
  generatePlacementItems,
} from "@zoonk/ai/tasks/v2/items/placement-items";
import { findOrCreateGoalCourse } from "@zoonk/core/library/curriculum/find-or-create-course";
import {
  getGoalCourseFormat,
  setGoalPrimaryCourse,
} from "@zoonk/core/library/curriculum/goal-primary-course";
import { type CurriculumScope, getContentReuse } from "@zoonk/core/library/curriculum/scope";
import { createItems } from "@zoonk/core/library/items/create";
import { type LearnerLookahead, getGoalLookahead } from "@zoonk/core/lookahead/learner-lookahead";
import {
  type PlacementItemFormat,
  type PlacementItemPick,
  type PlacementItemPicks,
  pickPlacementItemSkills,
} from "@zoonk/core/lookahead/placement-item-skills";
import {
  type PlanOutlineNeed,
  listPlanOutlineNeeds,
  listPlanSkillIdsWithin,
  listSoonStandInCourseIds,
} from "@zoonk/core/lookahead/plan-outline-needs";
import {
  pickPlanStartToWrite,
  pickSpeculativeLessons,
} from "@zoonk/core/lookahead/speculative-lessons";
import { type GoalKind, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";
import { startPictureChecks } from "../../images/start-picture-checks";
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

/** The plan's first lesson when it may be written now (see `pickPlanStartToWrite`). */
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

/**
 * The outlines a plan's stand-ins still need, by course and level band: those scheduled within
 * `days` of today, or all of them when `days` is null.
 */
export async function listPlanOutlineNeedsStep(input: {
  days: number | null;
  goalId: string;
}): Promise<PlanOutlineNeed[]> {
  "use step";

  return listPlanOutlineNeeds(input);
}

/** The courses whose stand-ins the plan schedules within `days` of today (see the core function). */
export async function listSoonStandInCourseIdsStep(input: {
  days: number;
  goalId: string;
}): Promise<string[]> {
  "use step";

  return listSoonStandInCourseIds(input);
}

/** How far ahead content is written for the goal's learner: a guest, a free learner or Plus. */
export async function readGoalLookaheadStep(goalId: string): Promise<LearnerLookahead> {
  "use step";

  return getGoalLookahead(goalId);
}

/** The skills the goal's plan gets to within `days` of today. */
export async function listPlanSkillIdsWithinStep(input: {
  days: number;
  goalId: string;
}): Promise<string[]> {
  "use step";

  return listPlanSkillIdsWithin(input);
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

type PlacementAnalytics = ReturnType<typeof toContentAnalytics>;

/** Stores one skill's questions in one format; they join the shared item bank. */
async function storeSkillItems({
  analytics,
  format,
  items,
  provenance,
  skill,
}: {
  analytics: PlacementAnalytics;
  format: PlacementItemFormat;
  items: PlacementSkillItems["quick"];
  provenance: PlacementProvenance;
  skill: PlacementItemPick;
}): Promise<number> {
  const { exam } = skill;

  const { created, unchecked } = await createItems({
    analytics,
    examBlueprintId: exam?.blueprintId ?? null,
    format,
    items,
    language: skill.language,
    optionCount: format === "multipleChoice" ? (exam?.optionCount ?? null) : null,
    provenance,
    skillId: skill.id,
  });

  // Questions are asked as soon as they're stored; their new pictures are checked meanwhile.
  await startPictureChecks({ analytics, assetIds: unchecked });

  return created.length;
}

/** Whether placement can now ask the skill: its quick question passed the checks and was stored. */
async function storePlacementItems({
  analytics,
  items,
  provenance,
  quickFormat,
  skill,
}: {
  analytics: PlacementAnalytics;
  items: PlacementSkillItems;
  provenance: PlacementProvenance;
  quickFormat: PlacementQuickFormat;
  skill: PlacementItemPick;
}): Promise<boolean> {
  const [quick] = await Promise.all([
    storeSkillItems({ analytics, format: quickFormat, items: items.quick, provenance, skill }),
    skill.needsTyped
      ? storeSkillItems({ analytics, format: "typed", items: items.typed, provenance, skill })
      : null,
  ]);

  return quick > 0;
}

/**
 * Writes placement's questions for a batch of skills in one call (placement waits on them, so the
 * first batch is the smallest), retried once right away, then stores each skill's. A skill counts as written
 * once placement can ask it; a failed call counts every skill in it as failed.
 */
async function writePlacementBatch({
  analytics,
  quickCount,
  quickFormat,
  skills,
  wait,
  workflowRunId,
}: WriteContext & {
  quickCount: number;
  quickFormat: PlacementQuickFormat;
  skills: PlacementItemPick[];
  /** `learner` for the batch the first question waits on; the rest are asked minutes later. */
  wait: CallWait;
}): Promise<PlacementItemsWritten> {
  const [first] = skills;

  if (!first) {
    return { failed: 0, written: 0 };
  }

  // The questions join the shared bank: an exam's or a language's are very likely asked again.
  const serviceTier = chooseServiceTier({
    reuse: getContentReuse({
      forExam: first.exam !== null,
      ownerId: first.ownerId,
      targetLanguage: first.targetLanguage,
    }),
    wait,
  });

  const generated = await safeAsync(() =>
    withOneRetry(() =>
      generatePlacementItems({
        analytics: toContentAnalytics({ analytics, scope: first, workflowRunId }),
        examFormat: first.exam,
        language: first.language,
        quickCount,
        quickFormat,
        serviceTier,
        skills: skills.map((skill) => ({
          description: skill.description,
          level: skill.level ?? "beginner",
          name: skill.name,
          usedSituations: skill.usedSituations,
        })),
        targetLanguage: first.targetLanguage,
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
        analytics: toContentAnalytics({ analytics, scope: skill, workflowRunId }),
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
  exceptAnswered,
  formats,
  goalId,
  quickCount = PLACEMENT_ITEMS_PER_SKILL.quick,
  quickNeeded,
  skillIds,
  workflowRunId,
}: WriteContext & {
  /** Questions the goal's learner answered don't count, as a focus test never asks them again. */
  exceptAnswered?: boolean;
  formats?: readonly PlacementItemFormat[];
  goalId: string;
  quickCount?: number;
  /** How many quick questions a skill already needs to have before it's skipped. */
  quickNeeded?: number;
  skillIds?: string[];
}): Promise<PlacementItemsWritten> {
  "use step";

  const { quickFormat, skills } = await pickPlacementItemSkills({
    exceptAnswered,
    formats,
    goalId,
    quickNeeded,
    skillIds,
  });

  const results = await Promise.all(
    toPlacementItemBatches({ quickCount, skills }).map((batch, index) =>
      writePlacementBatch({
        analytics,
        quickCount,
        quickFormat,
        skills: batch,
        wait: index === 0 ? "learner" : "soon",
        workflowRunId,
      }),
    ),
  );

  return countPlacementItems(results);
}
