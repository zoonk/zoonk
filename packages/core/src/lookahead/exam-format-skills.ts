import "server-only";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { toListeningExam } from "../exams/listening/listening-exam";
import { getListeningSkillIds } from "../exams/listening/listening-skills";
import {
  type ExamAnswerFormat,
  getMockFormatMix,
  getMockWritingFormat,
} from "../exams/mocks/mock-format-mix";
import { listAskedSkills } from "../library/exams/format-sections";
import { readBlueprintContent } from "../library/exams/save-exam-blueprint";
import { ANY_NUMBER } from "../library/items/_utils/numeric-entry";
import { takesNumericAnswers } from "../library/items/numeric-skills";
import { listPastQuestionExamples } from "../library/items/past-question-examples";
import { getSkillArea } from "../plans/planner/graph-areas";
import { parsePlanGraph } from "../plans/planner/plan-state";
import { toItemExam } from "./item-exam";
import { type PlacementItemSkill } from "./placement-item-skills";

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

export type ExamFormatPick = {
  answerFormat: ExamAnswerFormat;
  skill: PlacementItemSkill;
  style: string | null;
};

type SkillRow = {
  area: string | null;
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

  const formats = blueprint
    ? getMockFormatMix(readBlueprintContent(blueprint).structure).flatMap((format) =>
        format.writer.kind === "item"
          ? [{ ...format, answerFormat: format.writer.answerFormat }]
          : [],
      )
    : [];

  if (!blueprint || formats.length === 0) {
    return [];
  }

  const graph = parsePlanGraph(goal?.plan?.graph);
  const firstPhase = Math.min(...graph.skills.map((skill) => skill.phase));
  const listening = goal ? getListeningSkillIds({ exam: toListeningExam(goal), graph }) : new Set();

  const rankedSkills = graph.skills
    .filter((skill) => skill.phase === firstPhase && !listening.has(skill.skillId))
    .toSorted((a, b) => (b.weight ?? 0) - (a.weight ?? 0));

  const ranked = rankedSkills.map((skill) => skill.skillId);

  const areas = new Map(
    rankedSkills.map((skill) => [skill.skillId, getSkillArea({ graph, skill })]),
  );

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

  const skills = ranked.flatMap((id) => {
    const row = rows.find((candidate) => candidate.id === id);
    return row ? [{ ...row, area: areas.get(id) ?? null }] : [];
  });

  const exam = toItemExam(blueprint);


  const picks = formats.flatMap((format) =>
    listAskedSkills({ format, skills })
      .filter((skill) =>
        needsAnswerFormat({ answerFormat: format.answerFormat, blueprintId: blueprint.id, skill }),
      )
      .toSorted(
        (a, b) =>
          Number(isKnownInFormat({ answerFormat: format.answerFormat, skill: b })) -
          Number(isKnownInFormat({ answerFormat: format.answerFormat, skill: a })),
      )
      .slice(0, EXAM_FORMAT_SKILLS)
      .flatMap(({ area, items: _items, ...skill }) => {
        const own = getMockWritingFormat({
          format,
          names: area ? [area] : [],
        });

        return own ? [{ answerFormat: format.answerFormat, skill, style: own.style }] : [];
      }),
  );

  return Promise.all(
    picks.map(async ({ answerFormat, skill, style }) => {
      const pastQuestions = await listPastQuestionExamples({
        examBlueprintId: blueprint.id,
        skillIds: [skill.id],
      });

      return {
        answerFormat,
        skill: { ...skill, exam: { ...exam, pastQuestions }, usedSituations: [] },
        style,
      };
    }),
  );
}
