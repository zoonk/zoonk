import "server-only";
import { type ExamBlueprint, prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { namesMatch } from "../exams/_utils/name-match";
import { isWrittenSection } from "../exams/mocks/mock-plan";
import { getExamScale } from "../exams/scoring/exam-scales";
import { readBlueprintContent } from "../library/exams/save-exam-blueprint";
import { getSkillArea } from "../plans/planner/graph-areas";
import { parsePlanGraph } from "../plans/planner/plan-state";
import { type PlacementItemSkill, toItemExam } from "./placement-item-skills";

/** A few questions to start: the goal's essay block asks one every few days. */
const FREE_RESPONSE_SKILLS = 3;

/**
 * The written questions a class test's material can announce: an explanation (a dissertativa) or
 * a short written answer, such as a table of organelles to complete.
 */
const CLASS_TEST_WRITTEN_KINDS: ReadonlySet<string> = new Set(["essay", "shortAnswer"]);

/** Shorter words ("de", "da", "the") say nothing about what a question is about. */
const MIN_MATCH_WORD_LENGTH = 4;

type GraphSkill = ReturnType<typeof parsePlanGraph>["skills"][number];

type ExamStructure = ReturnType<typeof readBlueprintContent>["structure"];

/** A skill to write a written question for, and the question's form when the exam names one. */
type WrittenPick = { skill: GraphSkill; style: string | null };

/** An area named for a written part of the exam ("Prova discursiva"), in graphs older than kinds. */
const WRITTEN_AREA_NAME = /discursiv|reda[cç][aã]o|pe[cç]a t[eé]cnica/iu;

/**
 * The plan's skills an exam's written test practices: an AP goal's first phase (its free-response
 * questions span the course), or the skills of the areas named for the exam's written parts (a
 * Cebraspe "Prova discursiva", a redação). Empty for exams answered only in objective questions.
 */
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

  const written = (structure.mock?.sections ?? []).filter((section) =>
    isWrittenSection({ section, structure }),
  );

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

/**
 * The skill an announced question is about: the one whose name shares the most words with it
 * ("uma dissertativa sobre osmose" is the membrane transport skill that names osmosis), the most
 * weighted on a tie.
 */
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

/**
 * A class test read from the learner's own material: each written question the material
 * announces ("vai ter uma dissertativa sobre osmose", a table of organelles to complete) is
 * practiced on the skill it's about, in that question's own form, so the days before the test
 * rehearse the questions the teacher said would come, not only multiple choice.
 */
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

/** The written questions to write: a class test's announced ones, or the exam's written test. */
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

/**
 * The skills an exam goal gets essay questions for, so its essay block practices the exam's
 * written answers graded by their rubric: an AP goal's first-phase skills (College Board doesn't
 * allow reusing its questions, so they're written new, with scoring guidelines whose rows carry
 * their own points), the skills of an exam's written test (a discursive test, a peça técnica)
 * in the notice's own tasks, or a class test's announced written questions, each in its own form.
 * The most weighted skills first, skipping skills that already have one for this exam (questions
 * are shared). Empty for other goals.
 *
 * This is a workflow bridge: the goal id comes from the goal the public boundary created.
 */
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
      // None of these skills has a written question yet (`items: { none }` above).
      return { ...skill, exam: style ? { ...exam, style } : exam, usedSituations: [] };
    });
}
