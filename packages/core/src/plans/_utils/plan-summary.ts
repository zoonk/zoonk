import { z } from "zod";
import { planChangeInputSchema } from "../plan-contract";
import { toIsoDate } from "../planner/plan-calendar";
import { getSkillValue } from "../planner/selected-coverage";
import { planEffectSchema } from "./plan-change-payload";
import { type PlanContext } from "./plan-context";
import {
  type SelectedCoverage,
  type SelectedSummary,
  selectedSummarySchema,
} from "./selected-summary-contract";

const EPSILON = 1e-6;

const PLAN_SUMMARY_SCHEMA_VERSION = 3;

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

export const planSummarySchema = z
  .object({
    advice: z.object({
      feasibility: z.object({
        coreFits: z.boolean(),
        coveredShare: z.number(),
        deadline: z.iso.date().nullable(),
        deepensMostAsked: z.boolean(),
        fits: z.boolean(),
        measure: z.enum(["exam", "goal"]),
        timeCovers: z.boolean(),
      }),
      fitOffer: z
        .object({
          effect: planEffectSchema,
          fits: z.boolean(),
          operations: planChangeInputSchema.shape.operations,
        })
        .nullable(),
      fullCourseEndDate: z.iso.date().nullable(),
    }),
    basis: planSummaryBasisSchema,
    schemaVersion: z.literal(PLAN_SUMMARY_SCHEMA_VERSION),
    selected: selectedSummarySchema,
  })
  .strict();

export type PlanSummary = z.infer<typeof planSummarySchema>;

/**
 * Null when the stored summary doesn't describe this plan: read it as pending, never as a plan with
 * no work.
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

export function toPlanSummary({
  context,
  selected,
  advice,
}: {
  advice: PlanSummary["advice"];
  context: Pick<PlanContext, "goal" | "plan" | "timeZone" | "today">;
  selected: SelectedSummary;
}): PlanSummary {
  return {
    advice,
    basis: { ...getPlanSummaryBasis(context), planVersion: context.plan.version + 1 },
    schemaVersion: PLAN_SUMMARY_SCHEMA_VERSION,
    selected,
  };
}

/** @public A lesson's completion writes what it says. */
export type SummaryReduction =
  | { kind: "unchanged" }
  | { kind: "pending" }
  | { coveredShare: number | null; kind: "reduced"; summary: PlanSummary };

type CompletedItem = { lessonId: string | null };

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

export function getPlanSummaryBasis(
  context: Pick<PlanContext, "goal" | "plan" | "timeZone" | "today">,
): PlanSummary["basis"] {
  return {
    layoutInputVersion: context.plan.inputVersion,
    layoutStudyDay: toIsoDate(context.today),
    planId: context.plan.id,
    planVersion: context.plan.version,
    timeZone: context.timeZone,
    userId: context.goal.userId,
  };
}

export function readFreshPlanSummary({
  basis,
  value,
}: {
  basis: PlanSummary["basis"];
  value: unknown;
}): PlanSummary | null {
  const summary = readPlanSummary({
    plan: { id: basis.planId, userId: basis.userId, version: basis.planVersion },
    value,
  });

  return summary &&
    summary.basis.layoutStudyDay === basis.layoutStudyDay &&
    summary.basis.timeZone === basis.timeZone
    ? summary
    : null;
}
