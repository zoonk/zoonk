import "server-only";
import { type PlanEditTopic } from "@zoonk/ai/tasks/v2/plans/edit-intent";
import { type TopicSkillName, nameTopicSkills } from "@zoonk/ai/tasks/v2/plans/topic-skill-names";
import { type CourseLevel, prisma } from "@zoonk/db";
import { toProvenanceData } from "../../library/_utils/library-rows";
import { type CurriculumScope } from "../../library/curriculum/curriculum-scope";
import { resolveScopeSkills } from "../../library/curriculum/resolve-lesson-skills";
import { type AddedSkill } from "../plan-contract";
import { toIsoDate } from "../planner/plan-calendar";
import { type PlanContext } from "./plan-context";

const TOPIC_LESSONS = 8;

const DEFAULT_TOPIC_LEVEL: CourseLevel = "beginner";

type UnstartedSkill = { scheduledFor: Date | null; skillId: string };

function listUnstartedSkills(context: PlanContext): UnstartedSkill[] {
  const started = new Set(
    context.items.flatMap((item) => (item.skillId && item.status !== "todo" ? [item.skillId] : [])),
  );

  const lessons = context.items.filter(
    (item) => item.kind === "lesson" && item.skillId && !started.has(item.skillId),
  );

  const bySkill = Map.groupBy(lessons, (item) => item.skillId ?? "");

  return [...bySkill].map(([skillId, items]) => ({
    scheduledFor: items[0]?.scheduledFor ?? null,
    skillId,
  }));
}

function findTimedAnchor({
  startDate,
  unstarted,
}: {
  startDate: string;
  unstarted: readonly UnstartedSkill[];
}): string | null {
  return (
    unstarted.find((skill) => skill.scheduledFor && toIsoDate(skill.scheduledFor) >= startDate)
      ?.skillId ?? null
  );
}

function findAnchorSkillIds({
  context,
  count,
  startDate,
}: {
  context: PlanContext;
  count: number;
  startDate: string | null;
}) {
  const unstarted = listUnstartedSkills(context);
  const timed = startDate ? findTimedAnchor({ startDate, unstarted }) : null;
  const ids = unstarted.map((skill) => skill.skillId);
  const last = ids.length - 1;

  return Array.from({ length: count }, (_, index) => {
    const share = Math.floor(((index + 1) * ids.length) / (count + 1));
    return timed ?? ids[Math.min(last, Math.max(1, share))] ?? ids[0] ?? null;
  });
}

async function loadTopicScope(goal: PlanContext["goal"]): Promise<CurriculumScope> {
  const course = goal.primaryCourseId
    ? await prisma.course.findUnique({
        select: { language: true, targetLanguage: true },
        where: { id: goal.primaryCourseId },
      })
    : null;

  return {
    generalGoal: null,
    language: course?.language ?? goal.language,
    ownerId: null,
    targetLanguage: course?.targetLanguage ?? goal.targetLanguage,
  };
}

type NamedTopic = PlanEditTopic & { skill: TopicSkillName };

/**
 * The learner's words can name their teacher, school or test, so they go only to this call, never
 * to the shared skill, its search or its lessons.
 */
async function nameTopics({
  context,
  language,
  topics,
}: {
  context: PlanContext;
  language: string;
  topics: readonly PlanEditTopic[];
}) {
  const named = await nameTopicSkills({
    analytics: {
      contentScope: "personal",
      distinctId: context.goal.userId,
      goalId: context.goal.id,
    },
    language,
    topics: topics.map((topic) => ({
      description: topic.description,
      name: topic.name,
      subject: topic.area,
    })),
  });

  const withSkills = topics.flatMap((topic, index): NamedTopic[] => {
    const skill = named.data[index];
    return skill ? [{ ...topic, skill }] : [];
  });

  return { provenance: toProvenanceData(named.provenance), topics: withSkills };
}

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

export async function toTopicSkills({
  context,
  startDate,
  topics,
}: {
  context: PlanContext;
  /** YYYY-MM-DD; null spreads the topics through what the learner hasn't started. */
  startDate: string | null;
  topics: readonly PlanEditTopic[];
}): Promise<AddedSkill[]> {
  const scope = await loadTopicScope(context.goal);
  const named = await nameTopics({ context, language: scope.language, topics });
  const anchors = findAnchorSkillIds({ context, count: named.topics.length, startDate });
  const levels = await loadAnchorLevels(anchors);

  const skillIds = await resolveScopeSkills({
    analytics: { contentScope: "shared", distinctId: context.goal.userId, goalId: context.goal.id },
    provenance: named.provenance,
    scope,
    skills: named.topics.map((topic, index) => ({
      course: topic.area,
      description: topic.skill.description,
      level: levels[index] ?? DEFAULT_TOPIC_LEVEL,
      name: topic.skill.name,
    })),
  });

  return named.topics.flatMap((topic, index) => {
    const skillId = skillIds[index];
    const beforeSkillId = anchors[index] ?? null;
    const { name } = topic.skill;

    return skillId
      ? [{ area: topic.area, beforeSkillId, lessons: TOPIC_LESSONS, name, skillId }]
      : [];
  });
}
