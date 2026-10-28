import "server-only";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { toListeningExam } from "../exams/listening/listening-exam";
import { getListeningSkillIds } from "../exams/listening/listening-skills";
import { readBlueprintContent } from "../library/exams/save-exam-blueprint";
import { ANY_NUMBER } from "../library/items/_utils/numeric-entry";
import { takesNumericAnswers } from "../library/items/numeric-skills";
import { listPastQuestionExamples } from "../library/items/past-question-examples";
import { parsePlanGraph } from "../plans/planner/plan-state";
import { type ExamAnswerFormat, listExamAnswerFormats } from "./exam-answer-formats";
import { type PlacementItemSkill, toItemExam } from "./placement-item-skills";

const EXAM_FORMAT_SKILLS = 3;

function isInAnswerFormat({
  answerFormat,
  content,
}: {
  answerFormat: ExamAnswerFormat;
  content: unknown;
}): boolean {
  const fields = isJsonObject(content) ? content : {};

  return answerFormat.format === "numeric"
    ? JSON.stringify(fields.entry ?? ANY_NUMBER) === JSON.stringify(answerFormat.entry)
    : fields.select === answerFormat.select;
}

export type ExamFormatPick = { answerFormat: ExamAnswerFormat; skill: PlacementItemSkill };

type SkillRow = {
  description: string;
  id: string;
  isQuantitative: boolean | null;
  items: { content: unknown; examBlueprintId: string | null; format: string }[];
  language: string;
  level: PlacementItemSkill["level"];
  name: string;
  ownerId: string | null;
  targetLanguage: string | null;
};

function needsAnswerFormat({
  answerFormat,
  blueprintId,
  skill,
}: {
  answerFormat: ExamAnswerFormat;
  blueprintId: string;
  skill: SkillRow;
}): boolean {
  const ofFormat = skill.items.filter((item) => item.format === answerFormat.format);

  const written = ofFormat.some(
    (item) =>
      item.examBlueprintId === blueprintId &&
      isInAnswerFormat({ answerFormat, content: item.content }),
  );

  return !written && (answerFormat.format === "multipleChoice" || takesNumericAnswers(skill));
}

function isKnownInFormat({
  answerFormat,
  skill,
}: {
  answerFormat: ExamAnswerFormat;
  skill: SkillRow;
}): boolean {
  return (
    answerFormat.format === "multipleChoice" ||
    skill.isQuantitative === true ||
    skill.items.some((item) => item.format === "numeric")
  );
}

/** Workflow bridge: goalId must come from the goal created by the authenticated public boundary. */
export async function pickExamFormatSkills({
  goalId,
}: {
  goalId: string;
}): Promise<ExamFormatPick[]> {
  const goal = await prisma.goal.findUnique({
    select: {
      examBlueprint: true,
      kind: true,
      plan: { select: { graph: true } },
      targetLanguage: true,
    },
    where: { id: goalId },
  });

  const blueprint = goal?.kind === "exam" ? goal.examBlueprint : null;

  const answerFormats = blueprint
    ? listExamAnswerFormats(readBlueprintContent(blueprint).structure)
    : [];

  if (!blueprint || answerFormats.length === 0) {
    return [];
  }

  const graph = parsePlanGraph(goal?.plan?.graph);
  const firstPhase = Math.min(...graph.skills.map((skill) => skill.phase));
  const listening = goal ? getListeningSkillIds({ exam: toListeningExam(goal), graph }) : new Set();

  const ranked = graph.skills
    .filter((skill) => skill.phase === firstPhase && !listening.has(skill.skillId))
    .toSorted((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
    .map((skill) => skill.skillId);

  const rows = await prisma.skill.findMany({
    select: {
      description: true,
      id: true,
      isQuantitative: true,
      items: {
        select: { content: true, examBlueprintId: true, format: true },
        where: { format: { in: ["multipleChoice", "numeric"] } },
      },
      language: true,
      level: true,
      name: true,
      ownerId: true,
      targetLanguage: true,
    },
    where: { id: { in: ranked } },
  });

  const skills = ranked.flatMap((id) => rows.find((row) => row.id === id) ?? []);
  const exam = toItemExam(blueprint);

  const picks = answerFormats.flatMap((answerFormat) =>
    skills
      .filter((skill) => needsAnswerFormat({ answerFormat, blueprintId: blueprint.id, skill }))
      .toSorted(
        (a, b) =>
          Number(isKnownInFormat({ answerFormat, skill: b })) -
          Number(isKnownInFormat({ answerFormat, skill: a })),
      )
      .slice(0, EXAM_FORMAT_SKILLS)
      .map(({ items: _items, ...skill }) => ({ answerFormat, skill })),
  );

  return Promise.all(
    picks.map(async ({ answerFormat, skill }) => {
      const pastQuestions = await listPastQuestionExamples({
        examBlueprintId: blueprint.id,
        skillIds: [skill.id],
      });

      return {
        answerFormat,
        skill: { ...skill, exam: { ...exam, pastQuestions }, usedSituations: [] },
      };
    }),
  );
}
