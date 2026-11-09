import { getChallengeTimings } from "../../checkpoints/_utils/challenge-timing";
import { type CheckpointResult } from "../../checkpoints/_utils/checkpoint-results";
import { listTodayLearnBlocks } from "../../learner/facts/today-learn-blocks";
import { readTodayPlanSession } from "../../learner/facts/today-plan-session";
import { readExamBlueprint } from "../../library/exams/read-exam-blueprint";
import { previewTodayBlocks } from "../../sessions/_utils/read-study-day";
import { buildPhaseViews } from "./plan-phase-views";
import { type PlanReadContext, getPlanReadItemKey } from "./plan-read-projection";
import { getOutlinedUntil } from "./stand-in-lessons";
import { findUpNextItem, listTodayItems } from "./up-next-item";

export async function readPlanToday({ context, now }: { context: PlanReadContext; now: Date }) {
  const { goal, timeZone } = context;
  const session = await readTodayPlanSession(goal.userId, goal.id);

  if (session) {
    return { blocks: session.blocks, session };
  }

  const blueprint = goal.examBlueprintId ? await readExamBlueprint(goal.examBlueprintId) : null;
  const blocks = await previewTodayBlocks({ blueprint, goal, now, timeZone, userId: goal.userId });

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
    }),
    today: context.today,
    todayItemKeys: new Set(
      listTodayItems({ items, todayBlocks }).map((item) => getPlanReadItemKey(item)),
    ),
    upNextItemId: next ? getPlanReadItemKey(next) : null,
  });
}
