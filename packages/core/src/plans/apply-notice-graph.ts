import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type TransactionClient, prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { matchAreasToSubjects } from "../exams/_utils/match-areas";
import { loadSkillSurvivors } from "../learner/_utils/update-learner-skill";
import { type prepareNoticeGraphRepair } from "../library/curriculum/exam-graph-repair";
import { noticeSubjects } from "../library/curriculum/prune-notice-skills";
import { prunePlanNoticeGraph } from "../library/curriculum/prune-plan-notice-graph";
import { commitPlan } from "./_utils/commit-plan";
import { followPlanToday } from "./_utils/follow-plan-today";
import { parsePlanChangePayload, toPlanChangePayload } from "./_utils/plan-change-payload";
import { loadPlanAtToken } from "./_utils/plan-token";
import { isPlanUnchanged } from "./_utils/plan-unchanged";
import { computePlan } from "./_utils/replan";
import { NOTICE_SOURCE } from "./plan-change-contract";
import { PlanConflictError, withPlanRetry } from "./plan-conflict";
import { followNoticeGraph } from "./planner/follow-notice-graph";
import { addSharedOptionSkills, joinOptionSkills } from "./planner/option-skills";
import {
  type PlanGraph,
  type PlanGraphSkill,
  parsePlanGraph,
  parsePlanSettings,
} from "./planner/plan-state";

type NoticeRepair = NonNullable<Awaited<ReturnType<typeof prepareNoticeGraphRepair>>>;

async function loadPlanAdditions(planId: string): Promise<Set<string>> {
  const changes = await prisma.planChange.findMany({
    select: { payload: true },
    where: {
      payload: { array_contains: [{ kind: "addSkills" }], path: ["operations"] },
      planId,
      status: "applied",
    },
  });

  const ids = changes.flatMap((change) =>
    parsePlanChangePayload(change.payload).operations.flatMap((operation) =>
      operation.kind === "addSkills" ? operation.skills.map((skill) => skill.skillId) : [],
    ),
  );

  const survivorOf = await loadSkillSurvivors(ids);
  return new Set([...ids, ...ids.map((id) => survivorOf(id))]);
}

function describeDropped({
  current,
  dropped,
  graph,
}: {
  current: PlanGraph;
  dropped: ReadonlySet<string>;
  graph: PlanGraph;
}): string[] {
  const remaining = new Set(joinOptionSkills(graph).skills.map((skill) => skill.area));

  return [
    ...new Set(
      joinOptionSkills(current).skills.flatMap((skill) =>
        !skill.extra && dropped.has(skill.skillId)
          ? [skill.area && !remaining.has(skill.area) ? skill.area : skill.name]
          : [],
      ),
    ),
  ];
}

function addSharedExtras(graph: PlanGraph, shared: readonly PlanGraphSkill[]): PlanGraph {
  if (shared.length === 0) {
    return graph;
  }

  const existing = new Set(
    [...graph.skills, ...(graph.optionSkills ?? []), ...(graph.extraSkills ?? [])].map(
      (skill) => skill.skillId,
    ),
  );

  const missing = shared
    .filter((skill) => !existing.has(skill.skillId))
    .map((skill) => ({
      ...skill,
      phase: Math.min(skill.phase, Math.max(0, graph.phases.length - 1)),
    }));

  return missing.length === 0
    ? graph
    : { ...graph, extraSkills: [...(graph.extraSkills ?? []), ...missing] };
}

function listNoticeSubjects({
  notice,
  skills,
}: {
  notice: NoticeRepair;
  skills: readonly PlanGraphSkill[];
}): Set<number> {
  const studied = skills.filter((skill) => !skill.extra);
  const topics = new Set(studied.flatMap((skill) => skill.topics?.map(normalizeString) ?? []));

  const named = matchAreasToSubjects({
    areas: [...new Set(studied.flatMap((skill) => skill.area ?? []))],
    subjects: notice.subjects,
  });

  return new Set([
    ...named.values(),
    ...notice.subjects.flatMap((subject, index) =>
      subject.topics.some((topic) => topics.has(normalizeString(topic))) ? [index] : [],
    ),
  ]);
}

/**
 * A subject an earlier reading left out comes back once a corrected reading lists it again: whole
 * when the plan teaches none of it, and skill by skill when a base of it stayed in the plan. A
 * subject the plan teaches with skills of its own gains nothing, since the shared ones would
 * teach it twice.
 */
function addSharedSubjects(graph: PlanGraph, notice: NoticeRepair): PlanGraph {
  const planned = joinOptionSkills(graph).skills;
  const plannedIds = new Set(planned.map((skill) => skill.skillId));
  const sharedIds = new Set(notice.skills.map((skill) => skill.skillId));
  const taught = listNoticeSubjects({ notice, skills: planned });

  const followed = listNoticeSubjects({
    notice,
    skills: planned.filter((skill) => sharedIds.has(skill.skillId)),
  });

  const taughtTopics = new Set(
    planned.flatMap((skill) => (skill.extra ? [] : (skill.topics?.map(normalizeString) ?? []))),
  );

  const missing = notice.skills.filter((skill) => {
    if (!skill.area || skill.extra || plannedIds.has(skill.skillId)) {
      return false;
    }

    const subjects = [...listNoticeSubjects({ notice, skills: [skill] })];
    const topics = skill.topics ?? [];

    return (
      subjects.some((subject) => !taught.has(subject)) ||
      (topics.length > 0 &&
        subjects.some((subject) => followed.has(subject)) &&
        !topics.some((topic) => taughtTopics.has(normalizeString(topic))))
    );
  });

  if (missing.length === 0) {
    return graph;
  }

  const missingIds = new Set(missing.map((skill) => skill.skillId));

  return addSharedOptionSkills({
    areas: new Set(missing.flatMap((skill) => skill.area ?? [])),
    graph,
    shared: {
      phases: [],
      skills: notice.skills.filter(
        (skill) => plannedIds.has(skill.skillId) || missingIds.has(skill.skillId),
      ),
    },
  });
}

async function verifyNoticeInputs({
  addsShared,
  blueprintId,
  notice,
  tx,
}: {
  addsShared: boolean;
  blueprintId: string;
  notice: NoticeRepair;
  tx: TransactionClient;
}) {
  const latest = await tx.examBlueprint.findUnique({
    select: { ...(addsShared && { skillGraph: { select: { graph: true } } }), structure: true },
    where: { id: blueprintId },
  });

  const shared = addsShared && parsePlanGraph(latest?.skillGraph?.graph);

  if (
    !latest ||
    !isDeepStrictEqual(notice.subjects, noticeSubjects(latest.structure)) ||
    (shared &&
      !isDeepStrictEqual(
        { extraSkills: notice.extraSkills, skills: notice.skills },
        { extraSkills: shared.extraSkills ?? [], skills: joinOptionSkills(shared).skills },
      ))
  ) {
    throw new PlanConflictError();
  }
}

type NoticeGraphInput = {
  blueprintId: string;
  droppedSkillIds?: readonly string[];
  goalId: string;
  graph?: PlanGraph;
  legacy?: boolean;
  notice?: NoticeRepair;
};

async function checkNoticeGraph({
  blueprintId,
  droppedSkillIds = [],
  goalId,
  graph,
  legacy,
  notice,
}: NoticeGraphInput) {
  const saved = await prisma.plan.findFirst({
    select: { graph: true, id: true, inputVersion: true, settings: true, version: true },
    where: { goal: { examBlueprintId: blueprintId, kind: "exam", status: "active" }, goalId },
  });

  const current = parsePlanGraph(saved?.graph);

  if (!saved || current.skills.length === 0) {
    return null;
  }

  const checkedNotice =
    notice ??
    (await prisma.examBlueprint
      .findUnique({ select: { structure: true }, where: { id: blueprintId } })
      .then(
        (blueprint) =>
          blueprint && {
            extraSkills: [],
            skills: [],
            subjects: noticeSubjects(blueprint.structure),
          },
      ));

  if (!checkedNotice) {
    return null;
  }

  const protectedIds =
    graph || droppedSkillIds.length > 0 ? await loadPlanAdditions(saved.id) : null;

  const legacyReading =
    graph && legacy
      ? followNoticeGraph({ askedExtras: parsePlanSettings(saved.settings).extras, current, graph })
      : graph;

  const checked = await prunePlanNoticeGraph({
    graph: legacyReading ?? current,
    loadProtectedIds: async () => protectedIds ?? loadPlanAdditions(saved.id),
    subjects: checkedNotice.subjects,
  });

  const dropped = new Set([
    ...checked.dropped,
    ...droppedSkillIds.filter((id) => !protectedIds?.has(id)),
  ]);

  const repaired = addSharedExtras(
    addSharedSubjects(checked.graph, checkedNotice),
    checkedNotice.extraSkills,
  );

  const addsShared = repaired !== checked.graph;

  if (!graph && dropped.size === 0 && !addsShared) {
    return null;
  }

  return { addsShared, checkedNotice, current, dropped, repaired, saved };
}

async function settleNoticeGraph(input: NoticeGraphInput): Promise<boolean> {
  const { blueprintId, goalId, graph, legacy } = input;
  const repair = await checkNoticeGraph(input);

  if (!repair) {
    return false;
  }

  const { addsShared, checkedNotice, current, dropped, repaired, saved } = repair;
  const context = await loadPlanAtToken(goalId);

  if (
    !context ||
    context.goal.examBlueprintId !== blueprintId ||
    context.goal.kind !== "exam" ||
    context.goal.status !== "active"
  ) {
    return false;
  }

  if (
    saved.id !== context.plan.id ||
    saved.inputVersion !== context.plan.inputVersion ||
    saved.version !== context.plan.version
  ) {
    throw new PlanConflictError();
  }

  const nextGraph =
    graph && !legacy
      ? followNoticeGraph({
          askedExtras: context.state.settings.extras,
          current,
          droppedIds: dropped,
          graph: repaired,
        })
      : repaired;

  const state = { ...context.state, graph: nextGraph };

  const computed = await computePlan({ context, mode: "forced", state });

  if (isPlanUnchanged({ computed, context })) {
    return false;
  }

  const noticeRemoved = describeDropped({ current, dropped, graph: computed.state.graph });

  const changeId = await commitPlan({
    change:
      noticeRemoved.length > 0
        ? {
            kind: "noticeChanged",
            payload: toPlanChangePayload({
              effect: { ...computed.effect, noticeRemoved },
              operations: [{ kind: "followNotice" }],
              source: NOTICE_SOURCE,
            }),
            reason: "",
            status: "applied",
          }
        : null,
    computed,
    context,
    extraWrites: (tx) => verifyNoticeInputs({ addsShared, blueprintId, notice: checkedNotice, tx }),
  });

  await followPlanToday({ changeId, context });

  return true;
}

export function applyNoticeGraph(input: NoticeGraphInput): Promise<boolean> {
  // Placement can make the plan stale between loading it and saving the notice.
  return input.notice ? settleNoticeGraph(input) : withPlanRetry(() => settleNoticeGraph(input));
}
