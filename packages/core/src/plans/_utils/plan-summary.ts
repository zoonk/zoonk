import { z } from "zod";
import { toIsoDate } from "../planner/plan-calendar";
import { getSkillValue } from "../planner/selected-coverage";
import { type PlanContext } from "./plan-context";
import {
  type SelectedCoverage,
  type SelectedSummary,
  legacySelectedSummarySchema,
  selectedSummarySchema,
} from "./selected-summary-contract";

/** Floating-point sums of minutes must not read a covered skill as short. */
const EPSILON = 1e-6;

const PLAN_SUMMARY_SCHEMA_VERSION = 2;

/**
 * The stored plan a summary describes: its owner, plan and version, which make it valid, and the
 * input version and study day its layout committed at, which only say what its numbers are as of.
 */
const planSummaryBasisSchema = z
  .object({
    layoutInputVersion: z.int().nonnegative(),
    layoutStudyDay: z.iso.date(),
    planId: z.string(),
    planVersion: z.int().positive(),
    timeZone: z.string().min(1),
    userId: z.string(),
  })
  .strict();

/** The facts of the one selected build a layout posts with the plan it saves (see `readPlanSummary`). */
export const planSummarySchema = z
  .object({
    basis: planSummaryBasisSchema,
    schemaVersion: z.literal(PLAN_SUMMARY_SCHEMA_VERSION),
    selected: selectedSummarySchema,
  })
  .strict();

export type PlanSummary = z.infer<typeof planSummarySchema>;

/**
 * The stored plan's summary when it describes that plan: the version it was posted with is the
 * plan's, for its owner. It describes the plan whatever happened since (studying, a new day), never
 * a reason to build again. Null for a legacy or unrecognized value, which reads as pending, never as a plan with no work.
 */
export function readPlanSummary({
  plan,
  value,
}: {
  plan: { id: string; userId: string; version: number };
  value: unknown;
}): PlanSummary | null {
  const parsed = planSummarySchema.safeParse(value);

  if (!parsed.success) {
    return null;
  }

  const { basis } = parsed.data;

  return basis.userId === plan.userId &&
    basis.planId === plan.id &&
    basis.planVersion === plan.version
    ? parsed.data
    : null;
}

/**
 * The summary a layout write posts with the plan it saves: `context` is the write's, already
 * marked, so its input version is the one the write commits at, and the write makes the next
 * version (see `writePlan`).
 */
export function toPlanSummary({
  context,
  selected,
}: {
  context: Pick<PlanContext, "goal" | "plan" | "timeZone" | "today">;
  selected: SelectedSummary;
}): PlanSummary {
  return {
    basis: {
      layoutInputVersion: context.plan.inputVersion,
      layoutStudyDay: toIsoDate(context.today),
      planId: context.plan.id,
      planVersion: context.plan.version + 1,
      timeZone: context.timeZone,
      userId: context.goal.userId,
    },
    schemaVersion: PLAN_SUMMARY_SCHEMA_VERSION,
    selected,
  };
}

/**
 * What finishing items does to a stored summary (see `reduceCompletedSummary`).
 * @public A lesson's completion writes what it says.
 */
export type SummaryReduction =
  | { kind: "unchanged" }
  | { kind: "pending" }
  | { coveredShare: number | null; kind: "reduced"; summary: PlanSummary };

type CompletedItem = { lessonId: string | null };

/**
 * The coverage with these short lessons counted whole: each adds what it lacked to every skill it
 * counts for, and the share and whether it all fits follow, as `getCoverage` reads them.
 */
function creditShortLessons({
  coverage,
  credited,
}: {
  coverage: SelectedCoverage;
  credited: ReadonlySet<string>;
}): SelectedCoverage {
  const gains = Map.groupBy(
    coverage.shortLessons
      .filter((lesson) => credited.has(lesson.lessonId))
      .flatMap((lesson) =>
        lesson.skillIds.map((skillId) => ({
          minutes: Math.max(0, lesson.requiredRaw - lesson.countedRaw),
          skillId,
        })),
      ),
    (gain) => gain.skillId,
  );

  const skills = coverage.skills.map((skill) => {
    const gained = (gains.get(skill.skillId) ?? []).reduce((sum, gain) => sum + gain.minutes, 0);

    return skill.state === "measured"
      ? { ...skill, coveredRaw: Math.min(skill.requiredRaw, skill.coveredRaw + gained) }
      : skill;
  });

  const total = skills.reduce((sum, skill) => sum + skill.worth, 0);
  const covered = skills.reduce((sum, skill) => sum + skill.worth * getSkillValue(skill), 0);

  const whole = skills.every(
    (skill) =>
      skill.state === "settled" ||
      (skill.state === "measured" && skill.coveredRaw >= skill.requiredRaw - EPSILON),
  );

  return {
    ...coverage,
    coveredShare: total > 0 ? Math.min(1, Math.max(0, covered / total)) : null,
    fits: coverage.coreFits && total > 0 && whole,
    shortLessons: coverage.shortLessons.filter((lesson) => !credited.has(lesson.lessonId)),
    skills,
  };
}

/**
 * What finishing these items of the plan (done, or tested out) does to its stored summary: only a
 * lesson the plan counted less than whole by the deadline changes what it covers (one running past
 * the deadline, or after it), counted whole now for every skill it teaches, once however many
 * times it's reported. Other completions were counted already, so the summary stays as it is. The
 * requirement's sizes and the forecasts stay as of the layout. Without a summary that describes the
 * plan there's nothing to reduce: it reads as pending until the next layout.
 */
export function reduceCompletedSummary({
  completed,
  summary,
}: {
  completed: readonly CompletedItem[];
  summary: PlanSummary | null;
}): SummaryReduction {
  if (!summary) {
    return { kind: "pending" };
  }

  const coverage = summary.selected.coverage;
  const short = new Set(coverage?.shortLessons.map((lesson) => lesson.lessonId));

  const credited = new Set(
    completed.flatMap((item) => (item.lessonId && short.has(item.lessonId) ? [item.lessonId] : [])),
  );

  if (!coverage || credited.size === 0) {
    return { kind: "unchanged" };
  }

  const reduced = creditShortLessons({ coverage, credited });

  return {
    coveredShare: reduced.coveredShare,
    kind: "reduced",
    summary: { ...summary, selected: { ...summary.selected, coverage: reduced } },
  };
}

/**
 * The summary an undo puts back with the plan it restores: the snapshot's, for the version the
 * restore commits, with what the learner finished since counted (see `reduceCompletedSummary`).
 * Null for a snapshot without one that describes its plan, which reads as pending.
 */
export function reduceRestoredSummary({
  completed,
  planVersion,
  summary,
}: {
  completed: readonly CompletedItem[];
  planVersion: number;
  summary: PlanSummary | null;
}): PlanSummary | null {
  if (!summary) {
    return null;
  }

  const restored = { ...summary, basis: { ...summary.basis, planVersion } };
  const reduction = reduceCompletedSummary({ completed, summary: restored });

  return reduction.kind === "reduced" ? reduction.summary : restored;
}

const legacyBasisSchema = z
  .object({
    inputVersion: z.int().nonnegative(),
    planId: z.string(),
    planVersion: z.int().positive(),
    studyDay: z.iso.date(),
    timeZone: z.string().min(1),
    userId: z.string(),
  })
  .strict();

/**
 * A stored summary as the legacy reader sees it: its v1 basis (a v2 one with its layout's input
 * version and study day in the v1 fields), so the reader's callers keep their behavior until they
 * read with `readPlanSummary` (then it goes). A v1 value's facts have the v1 shape (see
 * `legacySelectedSummarySchema`), which no v2 reader takes: its `selected` reads as null.
 */
export const savedPlanSummarySchema = z.union([
  z
    .object({
      basis: legacyBasisSchema,
      schemaVersion: z.literal(1),
      selected: z.union([selectedSummarySchema, legacySelectedSummarySchema]),
    })
    .strict()
    .transform(({ selected, ...summary }) => ({
      ...summary,
      selected: selectedSummarySchema.safeParse(selected).data ?? null,
    })),
  planSummarySchema.transform(
    ({ basis: { layoutInputVersion, layoutStudyDay, ...basis }, selected }) => ({
      basis: { ...basis, inputVersion: layoutInputVersion, studyDay: layoutStudyDay },
      schemaVersion: 1 as const,
      selected,
    }),
  ),
]);

/** A stored summary as the legacy reader sees it (see `savedPlanSummarySchema`). */
export type SavedPlanSummary = {
  basis: z.infer<typeof legacyBasisSchema>;
  schemaVersion: 1;
  selected: SelectedSummary | null;
};

/**
 * The authorized reader's complete basis must match before it may skip a selected build: the
 * legacy reading, until its callers read with `readPlanSummary` (a summary describes its plan
 * version, whatever happened since).
 */
export function readFreshPlanSummary({
  basis,
  value,
}: {
  basis: SavedPlanSummary["basis"];
  value: unknown;
}): SavedPlanSummary | null {
  const parsed = savedPlanSummarySchema.safeParse(value);

  if (!parsed.success) {
    return null;
  }

  const saved = parsed.data.basis;

  return saved.userId === basis.userId &&
    saved.planId === basis.planId &&
    saved.inputVersion === basis.inputVersion &&
    saved.planVersion === basis.planVersion &&
    saved.studyDay === basis.studyDay &&
    saved.timeZone === basis.timeZone
    ? parsed.data
    : null;
}
