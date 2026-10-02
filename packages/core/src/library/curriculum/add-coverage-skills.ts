import { type checkCoverage } from "@zoonk/ai/tasks/v2/curriculum/coverage-check";
import { type GoalSkillGraph } from "./save-goal-skills";

type Coverage = Awaited<ReturnType<typeof checkCoverage>>["data"];
type MissingSkill = Coverage["missing"][number];
type GraphSkill = GoalSkillGraph["skills"][number];

/** A gap the references show is usually one idea: two short lessons until its outline says more. */
const COVERAGE_SKILL_LESSONS = 2;

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

function toGraphSkill({
  graph,
  key,
  missing,
}: {
  graph: GoalSkillGraph;
  key: string;
  missing: MissingSkill;
}): { after: number; skill: GraphSkill } {
  const prerequisites = graph.skills.filter((skill) => missing.prerequisites.includes(skill.key));
  const last = prerequisites.at(-1);
  const [firstSkill] = graph.skills;
  const anchor = last ?? firstSkill;

  return {
    after: last ? graph.skills.indexOf(last) : -1,
    skill: {
      course: anchor?.course ?? graph.courses[0]?.key ?? "",
      description: missing.description,
      estimatedLessons: COVERAGE_SKILL_LESSONS,
      examWeight: missing.examWeight,
      key,
      level: anchor?.level ?? "beginner",
      name: missing.name,
      phase: Math.max(1, ...prerequisites.map((skill) => skill.phase)),
      prerequisites: prerequisites.map((skill) => skill.key),
    },
  };
}

/**
 * Adds the skills a reference syllabus expects but the graph missed, with the exam weight the
 * check gave them. Each goes right after the last prerequisite the coverage check named, in that
 * prerequisite's course, band and phase, so the graph stays in teaching order; one without
 * prerequisites starts the graph.
 */
export function addCoverageSkills({
  graph,
  missing,
}: {
  graph: GoalSkillGraph;
  missing: readonly MissingSkill[];
}): GoalSkillGraph {
  if (missing.length === 0) {
    return graph;
  }

  const keys = toFreeKeys({ count: missing.length, graph });

  const additions = missing.map((item, index) =>
    toGraphSkill({ graph, key: keys[index] ?? `coverage-${index + 1}`, missing: item }),
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
export function reweightExamSkills({
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
