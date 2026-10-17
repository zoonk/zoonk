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

/** Enough gaps for the coach to pick the one the mistakes point at. */
const MAX_GAPS = 5;

/** A skill a gap adds, with the lessons it brings as its size in the plan's graph. */
type GapSkill = ActivitySkill & { lessons: number };

/**
 * A missing prerequisite of a skill the learner struggles with, and what filling it takes: the
 * unlearned chain it rests on (one lesson or a few), or its chapter when that chain is a chapter's
 * worth. `skills` are in teaching order and `lessons` counts what the plan would add.
 */
export type PrerequisiteGap = {
  beforeSkill: ActivitySkill;
  chapter: { id: string; title: string } | null;
  lessons: number;
  skill: ActivitySkill;
  skills: GapSkill[];
};

type GapRoot = Pick<PrerequisiteGap, "beforeSkill" | "skill">;

type PlanFootprint = { lessonIds: Set<string>; skillIds: string[] };

/** What the plan already teaches: its graph's skills and every skill and lesson it has items for. */
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

/** The direct missing prerequisites, weakest skill first, each once. */
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

/**
 * Swaps a gap that's a chapter's worth for its prerequisite's chapter: that chapter's skills the
 * plan doesn't teach and the learner hasn't started, in chapter order. A prerequisite without a
 * chapter keeps its chain.
 */
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

    // A chapter the plan already holds every lesson of adds nothing; the chain still does.
    return chapterGap.lessons > 0 ? chapterGap : gap;
  });
}

/**
 * The gaps a plan-change insight can fill for the skills a learner struggles with. Each missing
 * prerequisite is sized from its unlearned chain in the skill graph: one lesson, a few lessons, or,
 * when the chain is a chapter's worth, the chapter that teaches the prerequisite. Only gaps that
 * would add something to the plan are offered.
 */
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
