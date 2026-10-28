import "server-only";
import { type ExamBlueprint, prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { namesMatch } from "../exams/_utils/name-match";
import { getExamScale } from "../exams/scoring/exam-scales";
import { readBlueprintContent } from "../library/exams/save-exam-blueprint";
import { getSkillArea } from "../plans/planner/graph-areas";
import { parsePlanGraph } from "../plans/planner/plan-state";
import { type PlacementItemSkill, toItemExam } from "./placement-item-skills";

const FREE_RESPONSE_SKILLS = 3;

const CLASS_TEST_WRITTEN_KINDS: ReadonlySet<string> = new Set(["essay", "shortAnswer"]);

const MIN_MATCH_WORD_LENGTH = 4;

type GraphSkill = ReturnType<typeof parsePlanGraph>["skills"][number];

type ExamStructure = ReturnType<typeof readBlueprintContent>["structure"];

type WrittenPick = { skill: GraphSkill; style: string | null };

const WRITTEN_AREA_NAME = /discursiv|reda[cç][aã]o|pe[cç]a t[eé]cnica/iu;

function findWrittenSkills({
  blueprint,
  goal,
  graph,
  structure,
}: {
  blueprint: ExamBlueprint;
  goal: Parameters<typeof getExamScale>[0]["goal"];
  graph: ReturnType<typeof parsePlanGraph>;
  structure: ExamStructure;
}): GraphSkill[] {
  if (getExamScale({ blueprint, goal }) === "ap") {
    const firstPhase = Math.min(...graph.skills.map((skill) => skill.phase));
    return graph.skills.filter((skill) => skill.phase === firstPhase);
  }

  const written = (structure.mock?.sections ?? []).filter((section) => section.kind === "written");

  const hasWriting =
    written.length > 0 || structure.formats.some((format) => format.kind === "essay");

  if (!hasWriting) {
    return [];
  }

  return graph.skills.filter((skill) => {
    const area = getSkillArea({ graph, skill });

    return (
      written.some((section) => namesMatch(area, section.name)) || WRITTEN_AREA_NAME.test(area)
    );
  });
}

function toWords(text: string): Set<string> {
  return new Set(
    normalizeString(text)
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length >= MIN_MATCH_WORD_LENGTH),
  );
}

function findQuestionSkill({
  description,
  skills,
}: {
  description: string;
  skills: readonly GraphSkill[];
}): GraphSkill | undefined {
  const words = toWords(description);

  return skills
    .map((skill) => ({
      overlap: [...toWords(skill.name)].filter((word) => words.has(word)).length,
      skill,
    }))
    .toSorted((a, b) => b.overlap - a.overlap || (b.skill.weight ?? 0) - (a.skill.weight ?? 0))[0]
    ?.skill;
}

function findClassTestQuestions({
  graph,
  structure,
}: {
  graph: ReturnType<typeof parsePlanGraph>;
  structure: ExamStructure;
}): WrittenPick[] {
  return structure.formats
    .filter((format) => CLASS_TEST_WRITTEN_KINDS.has(format.kind))
    .flatMap((format) => {
      const skill = findQuestionSkill({ description: format.description, skills: graph.skills });
      return skill ? [{ skill, style: `${format.kind}: ${format.description}` }] : [];
    });
}

function pickWritten({
  blueprint,
  goal,
  graph,
}: {
  blueprint: ExamBlueprint;
  goal: Parameters<typeof getExamScale>[0]["goal"];
  graph: ReturnType<typeof parsePlanGraph>;
}): WrittenPick[] {
  const { structure } = readBlueprintContent(blueprint);

  if (blueprint.ownerId) {
    return findClassTestQuestions({ graph, structure });
  }

  return findWrittenSkills({ blueprint, goal, graph, structure })
    .toSorted((a, b) => a.phase - b.phase || (b.weight ?? 0) - (a.weight ?? 0))
    .map((skill) => ({ skill, style: null }));
}

/** Workflow bridge: goalId must come from the authenticated public boundary; never reuse restricted AP past questions. */
export async function pickFreeResponseSkills({
  goalId,
}: {
  goalId: string;
}): Promise<PlacementItemSkill[]> {
  const goal = await prisma.goal.findUnique({
    select: { examBlueprint: true, kind: true, plan: { select: { graph: true } }, title: true },
    where: { id: goalId },
  });

  const blueprint = goal?.kind === "exam" ? goal.examBlueprint : null;

  if (!blueprint) {
    return [];
  }

  const graph = parsePlanGraph(goal?.plan?.graph);
  const picks = pickWritten({ blueprint, goal, graph });
  const ranked = [...new Set(picks.map((pick) => pick.skill.skillId))];

  if (ranked.length === 0) {
    return [];
  }

  const skills = await prisma.skill.findMany({
    select: {
      description: true,
      id: true,
      language: true,
      level: true,
      name: true,
      ownerId: true,
      targetLanguage: true,
    },
    where: {
      id: { in: ranked },
      items: { none: { examBlueprintId: blueprint.id, format: "essay" } },
    },
  });

  const exam = toItemExam(blueprint);

  return ranked
    .flatMap((id) => skills.find((skill) => skill.id === id) ?? [])
    .slice(0, FREE_RESPONSE_SKILLS)
    .map((skill) => {
      const style = picks.find((pick) => pick.skill.skillId === skill.id)?.style;
      return { ...skill, exam: style ? { ...exam, style } : exam, usedSituations: [] };
    });
}
