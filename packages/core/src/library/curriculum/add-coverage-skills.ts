import { type checkCoverage } from "@zoonk/ai/tasks/v2/curriculum/coverage-check";
import {
  type ExamOutline,
  canBuildOn,
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

const COVERAGE_SKILL_LESSONS = 2;

const DEFAULT_TOPIC_WEIGHT = 3;

function toFreeKeys({ count, graph }: { count: number; graph: GoalSkillGraph }): string[] {
  const taken = new Set(graph.skills.map((skill) => skill.key));

  return Array.from({ length: graph.skills.length + count }, (_, index) => `coverage-${index + 1}`)
    .filter((key) => !taken.has(key))
    .slice(0, count);
}

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

function findFirstRunEnd({ area, graph }: { area: string; graph: GoalSkillGraph }): number {
  const start = graph.skills.findIndex((skill) => skill.area === area);
  const end = graph.skills.findIndex((skill, index) => index > start && skill.area !== area);

  if (start === -1) {
    return -1;
  }

  return end === -1 ? graph.skills.length - 1 : end - 1;
}

function findEarlierSubjectEnd({
  area,
  graph,
  outline,
}: {
  area: string | null | undefined;
  graph: GoalSkillGraph;
  outline?: ExamOutline;
}): number {
  const subjects = outline?.subjects ?? [];
  const position = subjects.findIndex((subject) => subject.name === area);

  const ends = subjects
    .slice(0, Math.max(0, position))
    .map((subject) => findFirstRunEnd({ area: subject.name, graph }));

  return ends.findLast((index) => index >= 0) ?? -1;
}

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

  if (subject[0] === undefined) {
    return findEarlierSubjectEnd({ area: missing.area, graph, outline });
  }

  return earlier.at(-1) ?? subject[0] - 1;
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
  const prerequisites = graph.skills.filter(
    (skill) =>
      missing.prerequisites.includes(skill.key) &&
      (!outline ||
        canBuildOn({ area: missing.area ?? "", outline, prerequisiteArea: skill.area ?? "" })),
  );

  const after = findAfter({ graph, missing, outline, prerequisites });

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

function getSubjectWeight({ graph, subject }: { graph: GoalSkillGraph; subject: string }) {
  const weights = graph.skills.flatMap((skill) =>
    skill.area === subject && skill.examWeight !== null ? [skill.examWeight] : [],
  );

  return weights.length === 0
    ? DEFAULT_TOPIC_WEIGHT
    : Math.round(weights.reduce((total, weight) => total + weight, 0) / weights.length);
}

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
