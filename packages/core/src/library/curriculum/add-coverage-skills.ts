import { type checkCoverage } from "@zoonk/ai/tasks/v2/curriculum/coverage-check";
import {
  type ExamOutline,
  findUncoveredTopics,
  isWrittenTestSubject,
} from "@zoonk/ai/tasks/v2/curriculum/exam-outline";
import { type GoalSkillGraph } from "./save-goal-skills";

type Coverage = Awaited<ReturnType<typeof checkCoverage>>["data"];

type MissingSkill = Pick<
  Coverage["missing"][number],
  "area" | "description" | "examWeight" | "name" | "prerequisites" | "topics"
>;

type GraphSkill = GoalSkillGraph["skills"][number];

/** A gap the references show is usually one idea: two short lessons until its outline says more. */
const COVERAGE_SKILL_LESSONS = 2;

/** A notice topic's weight when its subject has no weighted skill to take it from. */
const DEFAULT_TOPIC_WEIGHT = 3;

/**
 * Keys for the added skills that no skill in the graph uses yet: a graph checked again (an exam's
 * plan once research read its notice) may already have skills an earlier check added.
 */
function toFreeKeys({ count, graph }: { count: number; graph: GoalSkillGraph }): string[] {
  const taken = new Set(graph.skills.map((skill) => skill.key));

  return Array.from({ length: graph.skills.length + count }, (_, index) => `coverage-${index + 1}`)
    .filter((key) => !taken.has(key))
    .slice(0, count);
}

/** Where a skill's first topic sits in its subject's syllabus; the end when it has none. */
function getTopicOrder({
  outline,
  skill,
}: {
  outline?: ExamOutline;
  skill: { area: string | null; topics: readonly string[] };
}): number {
  const topics = outline?.subjects.find((subject) => subject.name === skill.area)?.topics ?? [];

  const positions = skill.topics
    .map((topic) => topics.indexOf(topic))
    .filter((index) => index >= 0);

  return positions.length > 0 ? Math.min(...positions) : Infinity;
}

/**
 * The skill a new one goes after, by the index in the graph: its last prerequisite; for a notice
 * topic, the last skill of its subject that teaches an earlier topic (or, when none does, it goes
 * right before the subject's first skill); otherwise none, and it starts the graph.
 */
function findAfter({
  graph,
  missing,
  outline,
  prerequisites,
}: {
  graph: GoalSkillGraph;
  missing: MissingSkill;
  outline?: ExamOutline;
  prerequisites: readonly GraphSkill[];
}): number {
  const last = prerequisites.at(-1);

  if (last) {
    return graph.skills.indexOf(last);
  }

  const order = getTopicOrder({ outline, skill: missing });

  const subject = graph.skills.flatMap((skill, index) =>
    skill.area === missing.area ? [index] : [],
  );

  const earlier = subject.filter((index) => {
    const skill = graph.skills[index];
    return skill !== undefined && getTopicOrder({ outline, skill }) < order;
  });

  return earlier.at(-1) ?? (subject[0] === undefined ? -1 : subject[0] - 1);
}

function toGraphSkill({
  graph,
  key,
  missing,
  outline,
}: {
  graph: GoalSkillGraph;
  key: string;
  missing: MissingSkill;
  outline?: ExamOutline;
}): { after: number; skill: GraphSkill } {
  const prerequisites = graph.skills.filter((skill) => missing.prerequisites.includes(skill.key));
  const after = findAfter({ graph, missing, outline, prerequisites });

  // The skill it sits next to lends it its course, band and phase: the one before it, or the one
  // it goes in front of when it starts its subject.
  const neighbor = graph.skills[after] ?? graph.skills[after + 1];
  const phases = prerequisites.length > 0 ? prerequisites : [neighbor];

  return {
    after,
    skill: {
      area: missing.area ?? neighbor?.area ?? "",
      course: neighbor?.course ?? graph.courses[0]?.key ?? "",
      description: missing.description,
      estimatedLessons: COVERAGE_SKILL_LESSONS,
      examWeight: missing.examWeight,
      key,
      level: neighbor?.level ?? "beginner",
      name: missing.name,
      ...(isWrittenTestArea({ area: missing.area, outline }) && { outcome: true }),
      phase: Math.max(1, ...phases.map((skill) => skill?.phase ?? 1)),
      prerequisites: prerequisites.map((skill) => skill.key),
      topics: missing.topics,
    },
  };
}

/** A skill added for the notice's written test, kept whole like the graph's own (see `outcome`). */
function isWrittenTestArea({
  area,
  outline,
}: {
  area: string | null | undefined;
  outline?: ExamOutline;
}): boolean {
  const subject = outline?.subjects.find((item) => item.name === area);
  return Boolean(subject && isWrittenTestSubject(subject));
}

/**
 * Adds the skills a reference syllabus expects but the graph missed, with the exam weight the
 * check gave them and, for an exam's notice, the subject and topics they teach. Each goes right
 * after the last prerequisite the coverage check named, in that prerequisite's course, band and
 * phase; a notice topic without prerequisites goes among its subject's skills in the notice's
 * order; any other starts the graph. The graph stays in teaching order.
 */
function addCoverageSkills({
  graph,
  missing,
  outline,
}: {
  graph: GoalSkillGraph;
  missing: readonly MissingSkill[];
  outline?: ExamOutline;
}): GoalSkillGraph {
  if (missing.length === 0) {
    return graph;
  }

  const keys = toFreeKeys({ count: missing.length, graph });

  const additions = missing.map((item, index) =>
    toGraphSkill({ graph, key: keys[index] ?? `coverage-${index + 1}`, missing: item, outline }),
  );

  const skills = [
    ...additions.filter((addition) => addition.after === -1).map((addition) => addition.skill),
    ...graph.skills.flatMap((skill, index) => [
      skill,
      ...additions.filter((addition) => addition.after === index).map((addition) => addition.skill),
    ]),
  ];

  return { ...graph, skills };
}

/**
 * Moves the exam weights the coverage check corrected: the notice's areas and topic frequency
 * show how much of the exam each skill is worth. Every other skill keeps its weight; none is
 * removed, so a skill the notice doesn't test stays, at weight 1 when the check says so.
 */
function reweightExamSkills({
  examWeights,
  graph,
}: {
  examWeights: readonly Coverage["examWeights"][number][];
  graph: GoalSkillGraph;
}): GoalSkillGraph {
  if (examWeights.length === 0) {
    return graph;
  }

  const weights = new Map(examWeights.map((change) => [change.key, change.examWeight]));

  return {
    ...graph,
    skills: graph.skills.map((skill) => ({
      ...skill,
      examWeight: weights.get(skill.key) ?? skill.examWeight,
    })),
  };
}

/** Puts the skills the check placed in their notice subject, with the topics they teach. */
function placeExamSkills({
  graph,
  placements,
}: {
  graph: GoalSkillGraph;
  placements: readonly Coverage["placements"][number][];
}): GoalSkillGraph {
  if (placements.length === 0) {
    return graph;
  }

  const places = new Map(placements.map((placement) => [placement.key, placement]));

  return {
    ...graph,
    skills: graph.skills.map((skill) => {
      const place = places.get(skill.key);
      return place ? { ...skill, area: place.area, topics: place.topics } : skill;
    }),
  };
}

/** A subject's usual weight in the graph, which a topic of it takes. */
function getSubjectWeight({ graph, subject }: { graph: GoalSkillGraph; subject: string }) {
  const weights = graph.skills.flatMap((skill) =>
    skill.area === subject && skill.examWeight !== null ? [skill.examWeight] : [],
  );

  return weights.length === 0
    ? DEFAULT_TOPIC_WEIGHT
    : Math.round(weights.reduce((total, weight) => total + weight, 0) / weights.length);
}

/**
 * Gives every notice topic no skill teaches a skill of its own, named as the notice names it, so
 * the plan always covers the whole syllabus a learner checks it against. The coverage check
 * writes these skills itself; this only catches a topic it left out.
 */
function coverRemainingTopics({
  graph,
  outline,
}: {
  graph: GoalSkillGraph;
  outline: ExamOutline;
}): GoalSkillGraph {
  const uncovered = findUncoveredTopics({ outline, skills: graph.skills });

  return addCoverageSkills({
    graph,
    missing: uncovered.map(({ subject, topic }) => ({
      area: subject,
      description: topic,
      examWeight: getSubjectWeight({ graph, subject }),
      name: topic,
      prerequisites: [],
      topics: [topic],
    })),
    outline,
  });
}

/**
 * A graph with what the coverage check found: weights corrected, skills placed in the notice's
 * subjects and topics, the missing skills added and, for an exam's notice, any topic still left
 * given its own skill. `changed` says whether anything moved.
 */
export function applyGraphCoverage({
  coverage,
  graph,
  outline,
}: {
  coverage: Coverage;
  graph: GoalSkillGraph;
  outline?: ExamOutline;
}): { changed: boolean; graph: GoalSkillGraph } {
  const { examWeights, missing, placements } = coverage;

  const checked = addCoverageSkills({
    graph: placeExamSkills({ graph: reweightExamSkills({ examWeights, graph }), placements }),
    missing,
    outline,
  });

  const covered = outline ? coverRemainingTopics({ graph: checked, outline }) : checked;
  const moved = examWeights.length > 0 || missing.length > 0 || placements.length > 0;

  return { changed: moved || covered !== checked, graph: covered };
}

/**
 * Whether a graph needs the coverage check: it has references to check against, or an exam's
 * notice has topics no skill teaches yet.
 */
export function needsCoverageCheck({
  graph,
  outline,
  references,
}: {
  graph: GoalSkillGraph;
  outline?: ExamOutline;
  references: readonly unknown[];
}): boolean {
  return (
    references.length > 0 ||
    (outline !== undefined && findUncoveredTopics({ outline, skills: graph.skills }).length > 0)
  );
}
