import { getChallengeTimings } from "../../checkpoints/_utils/challenge-timing";
import { type CheckpointResult } from "../../checkpoints/_utils/checkpoint-results";
import { listTodayLearnBlocks } from "../../learner/facts/today-learn-blocks";
import { type readTodayPlanSession } from "../../learner/facts/today-plan-session";
import { buildPhaseViews } from "./plan-phase-views";
import { type PlanReadContext, getPlanReadItemKey } from "./plan-read-projection";
import { getOutlinedUntil } from "./stand-in-lessons";
import { findUpNextItem, listTodayItems } from "./up-next-item";

type PathInput = Pick<
  Parameters<typeof buildPhaseViews>[0],
  | "chapterTitles"
  | "currentPhase"
  | "estimateMinutes"
  | "phaseChallengesRequired"
  | "shortPlan"
  | "skillAreas"
  | "taughtSkillIds"
> & {
  challengesOpen: boolean;
  context: PlanReadContext;
  todayPlan: Awaited<ReturnType<typeof readTodayPlanSession>>;
  challengeResults: ReadonlyMap<string, CheckpointResult>;
};

export function buildPlanPath({ context, todayPlan, challengeResults, ...input }: PathInput) {
  const { goal, items, phases, state } = context;
  const todaySession = todayPlan.session;

  const todayBlocks = listTodayLearnBlocks(todaySession?.blocks ?? []);

  const next = findUpNextItem({ items, todayBlocks });

  return buildPhaseViews({
    ...input,
    goalKind: goal.kind,
    items,
    outlinedUntil: getOutlinedUntil(context.today),
    phases,
    skillPhases: new Map(state.graph.skills.map((skill) => [skill.skillId, skill.phase])),
    studiesPastTarget: goal.kind === "exam" && state.settings.fullCourse,
    targetDate: goal.targetDate,
    timings: getChallengeTimings({
      goal,
      items,
      lastSessionChallenges: new Map(todayPlan.lastSessionChallenges),
      results: challengeResults,
      savedDay: todaySession !== null,
      settings: state.settings,
      today: context.today,
      todayBlocks: todaySession?.blocks,
    }),
    today: context.today,
    todayItemKeys: new Set(
      listTodayItems({ items, todayBlocks }).map((item) => getPlanReadItemKey(item)),
    ),
    upNextItemId: next ? getPlanReadItemKey(next) : null,
  });
}
