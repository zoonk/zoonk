import "server-only";
import { prisma } from "@zoonk/db";
import { listResumableLessonIds } from "../../lesson-player/_utils/lesson-runs";
import { type BuiltPlan } from "../planner/build-plan";
import { withAskedExtras } from "../planner/exam-extras";
import { type PlanGraph, type PlanGraphSkill, type PlanState } from "../planner/plan-state";
import { chooseExamOptionSkills } from "./exam-option-skills";
import { type PlanContext } from "./plan-context";
import { resolveMergedSkills } from "./planner-inputs";

function getPendingExtraItems(context: PlanContext): Map<string, string> {
  const extraIds = new Set(
    context.state.graph.skills.filter((skill) => skill.extra).map((skill) => skill.skillId),
  );

  return new Map(
    context.items.flatMap((item) =>
      item.status === "todo" && item.skillId && extraIds.has(item.skillId) && item.lessonId
        ? [[item.lessonId, item.id] as const]
        : [],
    ),
  );
}

async function findActiveExtraLessons({ context, now }: { context: PlanContext; now: Date }) {
  const lessonIds = [...getPendingExtraItems(context).keys()];

  if (lessonIds.length === 0) {
    return [];
  }

  const [blocks, runs] = await Promise.all([
    prisma.studySessionBlock.groupBy({
      by: ["lessonId"],
      where: {
        kind: "learn",
        lessonId: { in: lessonIds },
        session: { goalId: context.goal.id, status: "active" },
        status: "active",
      },
    }),
    listResumableLessonIds({
      goalId: context.goal.id,
      lessonIds,
      now,
      userId: context.goal.userId,
    }),
  ]);

  return [...runs, ...blocks.flatMap((block) => block.lessonId ?? [])];
}

export async function loadExtraPlanGraph({
  context,
  now,
  readExamOptionSource,
  state,
}: {
  context: PlanContext;
  now: Date;
  readExamOptionSource?: Parameters<typeof chooseExamOptionSkills>[0]["readSource"];
  state: PlanState;
}) {
  const [activeLessons, resolved] = await Promise.all([
    findActiveExtraLessons({ context, now }),
    chooseExamOptionSkills({
      goal: context.goal,
      graph: state.graph,
      picks: state.settings,
      readSource: readExamOptionSource,
    }).then((chosen) => resolveMergedSkills(withAskedExtras(chosen, state.settings.extras))),
  ]);

  const extraSkills = new Map(
    [
      ...context.state.graph.skills.filter((skill) => skill.extra),
      ...resolved.skills.filter((skill) => skill.extra),
    ].map((skill) => [skill.skillId, skill]),
  );

  return {
    extraSkills,
    getActiveItemIds: (forContext: PlanContext) => {
      const pending = getPendingExtraItems(forContext);
      return new Set(activeLessons.flatMap((lessonId) => pending.get(lessonId) ?? []));
    },
    resolved,
  };
}

export function withPlacedExtras({
  built,
  extraSkills,
  graph,
}: {
  built: BuiltPlan;
  extraSkills: ReadonlyMap<string, PlanGraphSkill>;
  graph: PlanGraph;
}): PlanGraph {
  if (extraSkills.size === 0) {
    return graph;
  }

  const held = new Set(
    built.items.flatMap((item) => (item.status === "todo" && item.skillId ? [item.skillId] : [])),
  );

  const skills = graph.skills.filter((skill) => !skill.extra);
  const ordinary = new Set(skills.map((skill) => skill.skillId));

  return {
    ...graph,
    skills: [
      ...skills,
      ...[...extraSkills.values()].filter(
        (skill) =>
          !ordinary.has(skill.skillId) &&
          (held.has(skill.skillId) || built.skillLessons.has(skill.skillId)),
      ),
    ],
  };
}
