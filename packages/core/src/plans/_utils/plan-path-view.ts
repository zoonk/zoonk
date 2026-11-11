import { getChallengeTimings } from "../../checkpoints/_utils/challenge-timing";
import { type CheckpointResult } from "../../checkpoints/_utils/checkpoint-results";
import { listTodayLearnBlocks } from "../../learner/facts/today-learn-blocks";
import { readTodayPlanSession } from "../../learner/facts/today-plan-session";
import { loadStudyWeek } from "../../progress/_utils/load-study-week";
import { previewToday } from "../../sessions/_utils/read-study-day";
import { buildPhaseViews } from "./plan-phase-views";
import { type PlanReadContext, getPlanReadItemKey } from "./plan-read-projection";
import { getOutlinedUntil } from "./stand-in-lessons";
import { findUpNextItem, listTodayItems } from "./up-next-item";

export async function readPlanToday({ context }: { context: PlanReadContext }) {
  const { goal, timeZone } = context;
  const session = await readTodayPlanSession(goal.userId, goal.id, timeZone);

  if (session) {
    return { blocks: session.blocks, plannedMinutes: session.plannedMinutes, session };
  }

  return { ...(await previewToday(goal.userId, goal.id, timeZone)), session };
}

/** Today's day before Start counts in the week as Today plans it. */
export async function readPlanWeek({ context }: { context: PlanReadContext }) {
  const { plannedMinutes, session } = await readPlanToday({ context });

  return loadStudyWeek({
    localDate: context.today,
    unbuiltDay: session ? undefined : { goalId: context.goal.id, plannedMinutes },
    userId: context.goal.userId,
  });
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
  challengesOpen: boolean;
  context: PlanReadContext;
  today: Awaited<ReturnType<typeof readPlanToday>>;
  challengeResults: ReadonlyMap<string, CheckpointResult>;
};

export function buildPlanPath({ challengeResults, context, today, ...input }: PathInput) {
  const { goal, items, phases, state } = context;

  const todayBlocks = listTodayLearnBlocks(today.session?.blocks ?? []);

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
