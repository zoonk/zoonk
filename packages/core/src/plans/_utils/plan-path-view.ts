import { getChallengeTimings } from "../../checkpoints/_utils/challenge-timing";
import { type CheckpointResult } from "../../checkpoints/_utils/checkpoint-results";
import { listTodayLearnBlocks } from "../../learner/facts/today-learn-blocks";
import { readTodayPlanSession } from "../../learner/facts/today-plan-session";
import { previewTodayBlocks } from "../../sessions/_utils/read-study-day";
import { type PlanView } from "../plan-view-contract";
import { buildPhaseViews } from "./plan-phase-views";
import { type PlanReadContext, getPlanReadItemKey } from "./plan-read-projection";
import { getOutlinedUntil } from "./stand-in-lessons";
import { findUpNextItem, listTodayItems } from "./up-next-item";

export async function readPlanToday({ context }: { context: PlanReadContext }) {
  const { goal, timeZone } = context;
  const session = await readTodayPlanSession(goal.userId, goal.id, timeZone);

  if (session) {
    return { blocks: session.blocks, session };
  }

  const blocks = await previewTodayBlocks(goal.userId, goal.id, timeZone);

  return { blocks, session };
}

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
  access: Pick<PlanView["access"], "freeWeekOver" | "mocksRequirePlus">;
  context: PlanReadContext;
  today: Awaited<ReturnType<typeof readPlanToday>>;
  challengeResults: ReadonlyMap<string, CheckpointResult>;
};

export function buildPlanPath({ access, challengeResults, context, today, ...input }: PathInput) {
  const { goal, items, phases, state } = context;

  const todayBlocks = listTodayLearnBlocks(today.session?.blocks ?? []);

  const next = findUpNextItem({ items, todayBlocks });

  return buildPhaseViews({
    ...input,
    challengesOpen: input.phaseChallengesRequired !== false && !access.freeWeekOver,
    goalKind: goal.kind,
    items,
    mocksRequirePlus: access.mocksRequirePlus,
    outlinedUntil: getOutlinedUntil(context.today),
    phases,
    skillPhases: new Map(state.graph.skills.map((skill) => [skill.skillId, skill.phase])),
    studiesPastTarget: goal.kind === "exam" && state.settings.fullCourse,
    targetDate: goal.targetDate,
    timings: getChallengeTimings({
      goal,
      items,
      results: challengeResults,
      settings: state.settings,
      today: context.today,
      todayBlocks: today.blocks,
      todaySessionDate: today.session?.localDate,
    }),
    today: context.today,
    todayItemKeys: new Set(
      listTodayItems({ items, todayBlocks }).map((item) => getPlanReadItemKey(item)),
    ),
    upNextItemId: next ? getPlanReadItemKey(next) : null,
  });
}
