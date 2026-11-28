import { getChallengeTimings } from "../../checkpoints/_utils/challenge-timing";
import { type CheckpointResult } from "../../checkpoints/_utils/checkpoint-results";
import { listTodayLearnBlocks } from "../../learner/facts/today-learn-blocks";
import { readTodayPlanSession } from "../../learner/facts/today-plan-session";
import { previewTodayBlocks } from "../../sessions/_utils/read-study-day";
import {
  listHeldSkillIds,
  listLeftOutSkills,
} from "../../view-models/syllabus/_utils/left-out-skills";
import { type SyllabusInput } from "../../view-models/syllabus/_utils/syllabus-input";
import { getNotPlannedReason } from "../../view-models/syllabus/_utils/syllabus-topics";
import { type PlanView } from "../plan-view-contract";
import { getSkillArea } from "../planner/graph-areas";
import { hasPlanDeadline, withinLessonScope } from "./plan-end";
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
  access: Pick<PlanView["access"], "mocksRequirePlus">;
  challengeDates?: ReadonlyMap<string, Date | null>;
  context: PlanReadContext;
  syllabus: Pick<SyllabusInput, "knownSkillIds" | "pastBasicsSkillIds" | "skippedBaseIds"> | null;
  today: Awaited<ReturnType<typeof readPlanToday>>;
  challengeResults: ReadonlyMap<string, CheckpointResult>;
};

export function buildPlanPath({
  access,
  challengeDates,
  challengeResults,
  context,
  syllabus,
  today,
  ...input
}: PathInput) {
  const { goal, items, phases, state } = context;

  const todayBlocks = listTodayLearnBlocks(today.session?.blocks ?? []);

  const next = findUpNextItem({ items, todayBlocks });
  const studiesPastTarget = goal.kind === "exam" && state.settings.fullCourse;
  const deadline = hasPlanDeadline({ studiesPastTarget, targetDate: goal.targetDate });

  const heldSkillIds = listHeldSkillIds(withinLessonScope({ deadline, items }));

  const leftOut = listLeftOutSkills({
    facts: {
      heldSkillIds,
      knownSkillIds: syllabus?.knownSkillIds ?? new Set(),
      pastBasicsSkillIds: syllabus?.pastBasicsSkillIds ?? new Set(),
      skippedAreas: state.settings.skippedAreas,
      skippedBaseIds: syllabus?.skippedBaseIds,
    },
    skills: state.graph.skills
      .filter((skill) => !skill.extra)
      .map((skill) => ({ ...skill, area: getSkillArea({ graph: state.graph, skill }) })),
  });

  const views = buildPhaseViews({
    ...input,
    challengesOpen: input.phaseChallengesRequired !== false,
    deferredLessons: state.graph.skills.reduce(
      (counts, { deferredLessons = 0, phase }) =>
        counts.set(phase, (counts.get(phase) ?? 0) + deferredLessons),
      new Map<number, number>(),
    ),
    goalKind: goal.kind,
    items,
    mocksRequirePlus: access.mocksRequirePlus,
    outlinedUntil: getOutlinedUntil(context.today),
    phaseReasons: new Map(
      phases.map((_, index) => {
        const skills = state.graph.skills.filter((skill) => skill.phase === index);

        const known =
          skills.length > 0 && skills.every((skill) => syllabus?.knownSkillIds.has(skill.skillId));

        const hasItems = items.some((item) => item.phase === index && item.kind === "lesson");

        const fallbackReason = !hasItems && known ? "known" : "time";

        return [
          index,
          getNotPlannedReason({
            hasItems,
            hasSkills: skills.length > 0,
            known,
            pastBasics: skills.every((skill) => syllabus?.pastBasicsSkillIds.has(skill.skillId)),
            skipped:
              skills.length > 0 &&
              skills.every((skill) =>
                state.settings.skippedAreas.includes(getSkillArea({ graph: state.graph, skill })),
              ),
            skippedBase: skills.every((skill) => syllabus?.skippedBaseIds?.has(skill.skillId)),
          }) ?? fallbackReason,
        ];
      }),
    ),
    phases,
    skillPhases: new Map(state.graph.skills.map((skill) => [skill.skillId, skill.phase])),
    studiesPastTarget,
    targetDate: goal.targetDate,
    timings: getChallengeTimings({
      challengeDates,
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

  return views.map((phase) => ({
    ...phase,
    leftOut:
      phase.kind === "learn" && phase.state !== "leftOut"
        ? leftOut.flatMap((skill) => (skill.phase === phase.index ? [skill.name] : []))
        : [],
  }));
}
