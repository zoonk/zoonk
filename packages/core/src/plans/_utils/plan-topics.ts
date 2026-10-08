import "server-only";
import { type PlanEditTopic } from "@zoonk/ai/tasks/v2/plans/edit-intent";
import { type CourseLevel, prisma } from "@zoonk/db";
import { type LibraryProvenance } from "../../library/_utils/library-rows";
import { type CurriculumScope } from "../../library/curriculum/curriculum-scope";
import { resolveScopeSkills } from "../../library/curriculum/resolve-lesson-skills";
import { type AddedSkill } from "../plan-contract";
import { type PlanContext } from "./plan-context";

/**
 * A topic the learner adds is about a chapter's worth of lessons: what the Library's next chapter
 * writes for it, and the fewest a skill keeps a stand-in for. A language goal's plan shares its
 * lessons among its situations (`sizeLanguageGraph`), the new ones included.
 */
const TOPIC_LESSONS = 8;

const DEFAULT_TOPIC_LEVEL: CourseLevel = "beginner";

/** The skills the learner hasn't started, in the plan's order: what it teaches next. */
function listUnstartedSkillIds(context: PlanContext): string[] {
  const started = new Set(
    context.items.flatMap((item) => (item.skillId && item.status !== "todo" ? [item.skillId] : [])),
  );

  return [
    ...new Set(
      context.items.flatMap((item) =>
        item.kind === "lesson" && item.skillId && !started.has(item.skillId) ? [item.skillId] : [],
      ),
    ),
  ];
}

/**
 * The skill each added topic comes before: the topics spread through the skills the learner
 * hasn't started, each after an even share of them, so they come in among what the plan teaches
 * instead of all ahead of it (Marcos got 19 field lessons before his interview basics), and never
 * ahead of the skill the learner starts next while another is left. Null puts a topic at the start
 * of the plan's first phase, when every skill has started.
 */
function findAnchorSkillIds({ context, count }: { context: PlanContext; count: number }) {
  const unstarted = listUnstartedSkillIds(context);
  const last = unstarted.length - 1;

  return Array.from({ length: count }, (_, index) => {
    const share = Math.floor(((index + 1) * unstarted.length) / (count + 1));
    return unstarted[Math.min(last, Math.max(1, share))] ?? unstarted[0] ?? null;
  });
}

/**
 * Where the goal's Library content lives: its course's language and owner (a private course is
 * its learner's), so a topic resolves to the skills its other lessons share.
 */
async function loadGoalScope(goal: PlanContext["goal"]): Promise<CurriculumScope> {
  const course = goal.primaryCourseId
    ? await prisma.course.findUnique({
        select: { language: true, targetLanguage: true, userId: true, visibility: true },
        where: { id: goal.primaryCourseId },
      })
    : null;

  return {
    generalGoal: null,
    language: course?.language ?? goal.language,
    ownerId: course?.visibility === "private" ? course.userId : null,
    targetLanguage: course?.targetLanguage ?? goal.targetLanguage,
  };
}

/**
 * The Library level of the skills the topics come before, so each is written at the learner's
 * level where it comes in.
 */
async function loadAnchorLevels(skillIds: readonly (string | null)[]) {
  const skills = await prisma.skill.findMany({
    select: { id: true, level: true },
    where: { id: { in: skillIds.flatMap((skillId) => skillId ?? []) } },
  });

  const levels = new Map(skills.map((skill) => [skill.id, skill.level]));

  return skillIds.map(
    (skillId): CourseLevel => (skillId ? levels.get(skillId) : null) ?? DEFAULT_TOPIC_LEVEL,
  );
}

/**
 * The skills for the topics a learner asked their plan to add (SQL for a data analyst's English,
 * a portfolio project), found in the Library or created there, so other learners' lessons on them
 * are shared: each a chapter's worth of lessons under its area, spread through what the learner
 * hasn't started (see `findAnchorSkillIds`). The planner adds them as stand-ins and the Library
 * outlines them as they come up.
 */
export async function toTopicSkills({
  context,
  provenance,
  topics,
}: {
  context: PlanContext;
  provenance: LibraryProvenance;
  topics: readonly PlanEditTopic[];
}): Promise<AddedSkill[]> {
  const anchors = findAnchorSkillIds({ context, count: topics.length });

  const [scope, levels] = await Promise.all([
    loadGoalScope(context.goal),
    loadAnchorLevels(anchors),
  ]);

  const skillIds = await resolveScopeSkills({
    analytics: {
      contentScope: scope.ownerId ? "personal" : "shared",
      distinctId: context.goal.userId,
      goalId: context.goal.id,
    },
    provenance,
    scope,
    skills: topics.map((topic, index) => ({
      course: topic.area,
      description: topic.description,
      level: levels[index] ?? DEFAULT_TOPIC_LEVEL,
      name: topic.name,
    })),
  });

  return topics.flatMap((topic, index) => {
    const skillId = skillIds[index];
    const beforeSkillId = anchors[index] ?? null;

    return skillId
      ? [{ area: topic.area, beforeSkillId, lessons: TOPIC_LESSONS, name: topic.name, skillId }]
      : [];
  });
}
