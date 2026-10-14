import { type PlanContext } from "./plan-context";
import { buildPhaseViews } from "./plan-phase-views";
import { getOutlinedUntil } from "./stand-in-lessons";
import { type TodayLearnBlock, findUpNextItem } from "./up-next-item";

type PathInput = Pick<
  Parameters<typeof buildPhaseViews>[0],
  | "chapterTitles"
  | "currentPhase"
  | "estimateMinutes"
  | "phaseChallengesRequired"
  | "shortPlan"
  | "skillAreas"
  | "taughtSkillIds"
> & { challengesOpen: boolean; context: PlanContext; todayBlocks: readonly TodayLearnBlock[] };

/** The path keeps locked challenges visible while its phase progress counts accessible work. */
export function buildPlanPath({ context, todayBlocks, ...input }: PathInput) {
  const { goal, items, phases, state } = context;

  return buildPhaseViews({
    ...input,
    goalKind: goal.kind,
    items,
    outlinedUntil: getOutlinedUntil(context.today),
    phases,
    skillPhases: new Map(state.graph.skills.map((skill) => [skill.skillId, skill.phase])),
    studiesPastTarget: goal.kind === "exam" && state.settings.fullCourse,
    targetDate: goal.targetDate,
    today: context.today,
    upNextItemId: findUpNextItem({ items, todayBlocks })?.id ?? null,
  });
}
