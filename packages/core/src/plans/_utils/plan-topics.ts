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

/**
 * A topic the learner adds is about a chapter's worth of lessons: what the Library's next chapter
 * writes for it, and the fewest a skill keeps a stand-in for. A language goal's plan shares its
 * lessons among its situations (`sizeLanguageGraph`), the new ones included.
 */
const TOPIC_LESSONS = 8;

const DEFAULT_TOPIC_LEVEL: CourseLevel = "beginner";

/** A skill the learner hasn't started, with the day its first lesson is planned. */
type UnstartedSkill = { scheduledFor: Date | null; skillId: string };

/** The skills the learner hasn't started, in the plan's order: what it teaches next. */
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

/**
 * The skill the topics come before when the learner said when they start ("logo", "next week"):
 * the first one not started whose lessons begin on that day or later, so the topics are what the
 * plan teaches next from then on. Null when the plan starts nothing new from that day.
 */
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

/**
 * The skill each added topic comes before. From the day the learner said they start, all of them
 * come next (`findTimedAnchor`): Carla asked to start her school's portfolio project "logo" and
 * it came seven weeks later. Otherwise the topics spread through the skills the learner hasn't
 * started, each after an even share of them, so they come in among what the plan teaches instead
 * of all ahead of it (Marcos got 19 field lessons before his interview basics), and never ahead
 * of the skill the learner starts next while another is left. Null puts a topic at the start of
 * the plan's first phase, when every skill has started.
 */
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

/**
 * Where an added topic's skill lives: the shared Library, in the language of the goal's course,
 * so it resolves to the skill every learner who needs it shares. Only what the learner's own
 * material teaches is private, and a topic they ask for in words isn't that.
 */
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

/** A topic the learner asked for, with the shared skill name it's added under. */
type NamedTopic = PlanEditTopic & { skill: TopicSkillName };

/**
 * The topics named as shared Library skills (see `nameTopicSkills`): the learner's words, which can
 * name their teacher, school or test, go to that one call and never to the shared skill, its search
 * or its lessons. A topic the call couldn't name isn't added. Returns the call's provenance, which
 * the skills it creates keep.
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
 * a portfolio project), each named as a shared skill first (see `nameTopics`), then found in the
 * Library or created there under that name, so other learners' lessons on them are shared: each a
 * chapter's worth of lessons under its area, from the day the learner said (`startDate`) or spread
 * through what they haven't started (see `findAnchorSkillIds`). The planner adds them as stand-ins
 * and the Library outlines them as they come up.
 */
export async function toTopicSkills({
  context,
  startDate,
  topics,
}: {
  context: PlanContext;
  /** The day the learner said the topics start (YYYY-MM-DD); null spreads them. */
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
