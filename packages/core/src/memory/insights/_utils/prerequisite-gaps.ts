import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { loadSkillLessons } from "../../../plans/_utils/planner-lessons";
import { parsePlanGraph } from "../../../plans/planner/plan-state";
import { type PlannerLesson } from "../../../plans/planner/plan-units";
import { type ActivitySkill } from "./activity-signals";
import {
  countGapLessons,
  findSkillChapterId,
  isChapterSized,
  orderPrerequisiteChain,
} from "./gap-size";
import { type PrerequisiteGraph, loadUnlearnedPrerequisites } from "./prerequisite-chain";
import { loadChapterGapSkills } from "./prerequisite-chapters";

const MAX_GAPS = 5;

type GapSkill = ActivitySkill & { lessons: number };

export type PrerequisiteGap = {
  beforeSkill: ActivitySkill;
  chapter: { id: string; title: string } | null;
  lessons: number;
  skill: ActivitySkill;
  skills: GapSkill[];
};

type GapRoot = Pick<PrerequisiteGap, "beforeSkill" | "skill">;

type PlanFootprint = { lessonIds: Set<string>; skillIds: string[] };

async function loadPlanFootprint({
  goalId,
  goalSkills,
}: {
  goalId: string;
  goalSkills: readonly ActivitySkill[];
}): Promise<PlanFootprint> {
  const plan = await prisma.plan.findUnique({
    select: { graph: true, items: { select: { lessonId: true } } },
    where: { goalId },
  });

  const graphSkillIds = parsePlanGraph(plan?.graph).skills.map((skill) => skill.skillId);

  return {
    lessonIds: new Set(plan?.items.flatMap((item) => item.lessonId ?? [])),
    skillIds: [...new Set([...goalSkills.map((skill) => skill.id), ...graphSkillIds])],
  };
}

function findRoots({
  graph,
  weakSkills,
}: {
  graph: PrerequisiteGraph;
  weakSkills: readonly ActivitySkill[];
}): GapRoot[] {
  const roots = weakSkills.flatMap((beforeSkill) =>
    graph.edges
      .filter((edge) => edge.skillId === beforeSkill.id)
      .flatMap((edge) => {
        const skill = graph.skills.get(edge.prerequisiteId);
        return skill ? [{ beforeSkill, skill }] : [];
      }),
  );

  return roots
    .filter((root, index) => roots.findIndex((other) => other.skill.id === root.skill.id) === index)
    .slice(0, MAX_GAPS);
}

function toGap({
  chapter = null,
  footprint,
  lessons,
  root,
  skills,
}: {
  chapter?: PrerequisiteGap["chapter"];
  footprint: PlanFootprint;
  lessons: readonly PlannerLesson[];
  root: GapRoot;
  skills: readonly ActivitySkill[];
}): PrerequisiteGap {
  const count = countGapLessons({
    lessons,
    plannedLessonIds: footprint.lessonIds,
    skillIds: skills.map((skill) => skill.id),
  });

  return {
    ...root,
    chapter,
    lessons: count.lessons,
    skills: skills.map((skill) => ({ ...skill, lessons: count.perSkill.get(skill.id) ?? 1 })),
  };
}

async function toChapterGaps({
  footprint,
  gaps,
  goal,
  lessons,
}: {
  footprint: PlanFootprint;
  gaps: PrerequisiteGap[];
  goal: Pick<Goal, "examBlueprintId" | "kind" | "userId">;
  lessons: readonly PlannerLesson[];
}): Promise<PrerequisiteGap[]> {
  const chapterIds = new Map(
    gaps
      .filter((gap) => isChapterSized(gap.lessons))
      .flatMap((gap) => {
        const chapterId = findSkillChapterId({ lessons, skillId: gap.skill.id });
        return chapterId ? [[gap.skill.id, chapterId] as const] : [];
      }),
  );

  if (chapterIds.size === 0) {
    return gaps;
  }

  const chapters = await loadChapterGapSkills({
    chapterIds: [...new Set(chapterIds.values())],
    excludedIds: footprint.skillIds,
    userId: goal.userId,
  });

  const chapterLessons = await loadSkillLessons({
    goal,
    skillIds: [
      ...new Set(
        [...chapters.values()].flatMap((chapter) => chapter.skills.map((skill) => skill.id)),
      ),
    ],
    userId: goal.userId,
  });

  return gaps.map((gap) => {
    const chapter = chapters.get(chapterIds.get(gap.skill.id) ?? "");

    if (!chapter || chapter.skills.length === 0) {
      return gap;
    }

    const chapterGap = toGap({
      chapter: { id: chapter.id, title: chapter.title },
      footprint,
      lessons: chapterLessons,
      root: { beforeSkill: gap.beforeSkill, skill: gap.skill },
      skills: chapter.skills,
    });

    return chapterGap.lessons > 0 ? chapterGap : gap;
  });
}

export async function loadPrerequisiteGaps({
  goal,
  goalSkills,
  weakSkills,
}: {
  goal: Pick<Goal, "examBlueprintId" | "id" | "kind" | "userId">;
  goalSkills: readonly ActivitySkill[];
  weakSkills: readonly ActivitySkill[];
}): Promise<PrerequisiteGap[]> {
  if (weakSkills.length === 0) {
    return [];
  }

  const footprint = await loadPlanFootprint({ goalId: goal.id, goalSkills });

  const graph = await loadUnlearnedPrerequisites({
    excludedIds: footprint.skillIds,
    skillIds: weakSkills.map((skill) => skill.id),
    userId: goal.userId,
  });

  const chains = findRoots({ graph, weakSkills }).map((root) => ({
    root,
    skills: orderPrerequisiteChain({ edges: graph.edges, rootId: root.skill.id }).flatMap(
      (skillId) => graph.skills.get(skillId) ?? [],
    ),
  }));

  if (chains.length === 0) {
    return [];
  }

  const lessons = await loadSkillLessons({
    goal,
    skillIds: [...new Set(chains.flatMap((chain) => chain.skills.map((skill) => skill.id)))],
    userId: goal.userId,
  });

  const gaps = await toChapterGaps({
    footprint,
    gaps: chains.map((chain) => toGap({ footprint, lessons, ...chain })),
    goal,
    lessons,
  });

  return gaps.filter((gap) => gap.lessons > 0);
}
