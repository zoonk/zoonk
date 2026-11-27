import "server-only";
import { type RecallQuestion, toRecallQuestion } from "@zoonk/ai/tasks/items/recall-question";
import { GENERATED_ITEM_SCHEMAS } from "@zoonk/ai/tasks/items/schemas";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { readBlueprintContent } from "../../library/exams/save-exam-blueprint";
import { toItemSetStimulus } from "../../library/items/check-item-set-keys";
import { getPublicItemFilter } from "../../library/items/item-field";
import { parseItemSetContent } from "../../library/items/item-set-content";
import { ITEM_WRITING_SKILL_SELECT } from "../../library/items/item-writing-skill";
import { listPastQuestionExamples } from "../../library/items/past-question-examples";
import { getItemSituation, toSituationOpening } from "../../library/items/used-situations";
import { CURRENT_STEPS } from "../../library/lessons/lesson-versions";
import { getGoalItemExam } from "../../lookahead/item-exam";
import { type PlacementItemSkill } from "../../lookahead/placement-item-skills";
import { getWrongPenalty } from "../scoring/mock-scoring";
import { readLessonRecallQuestions } from "./mock-lesson-questions";

const MAX_MOCK_SITUATIONS = 32;

export type MockWritingSkill = PlacementItemSkill & {
  earlier: RecallQuestion[];
  wrongPenalty: number | null;
};

async function loadSkillHistory(
  skillId: string,
  ownerId: string | null,
  privateBlueprintId: string | null,
) {
  const [items, steps] = await Promise.all([
    prisma.item.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        content: true,
        format: true,
        mockOnly: true,
        set: { select: { content: true, kind: true } },
      },
      where: {
        ...(ownerId
          ? {}
          : {
              OR: [
                getPublicItemFilter(),
                ...(privateBlueprintId ? [{ examBlueprintId: privateBlueprintId }] : []),
              ],
            }),
        skillId,
      },
    }),
    prisma.step.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        content: true,
        kind: true,
        lesson: {
          select: {
            sentences: {
              select: { sentence: { select: { id: true, sentence: true } }, translation: true },
            },
            words: { select: { translation: true, word: { select: { id: true, word: true } } } },
          },
        },
        sentenceId: true,
        wordId: true,
      },
      where: {
        ...CURRENT_STEPS,
        OR: [{ skillId }, { lesson: { skills: { some: { skillId } } }, skillId: null }],
        lesson: ownerId
          ? { OR: [{ visibility: "public" }, { ownerId }] }
          : { visibility: "public" },
      },
    }),
  ]);

  const questions = items.flatMap((item) => {
    const parsed = GENERATED_ITEM_SCHEMAS[item.format].safeParse({
      ...(isJsonObject(item.content) && item.content),
      difficulty: "medium",
      format: item.format,
    });

    if (!parsed.success) {
      return [];
    }

    const question = toRecallQuestion(parsed.data);
    const stimulus = item.set && toItemSetStimulus(parseItemSetContent(item.set));

    return [
      {
        example: {
          ...question,
          question: [stimulus, question.question].filter(Boolean).join("\n"),
        },
        reserve: item.mockOnly,
      },
    ];
  });

  const practice = questions.filter((item) => !item.reserve).map((item) => item.example);
  const lessons = steps.flatMap((step) => readLessonRecallQuestions(step));

  return {
    earlier: [
      ...Array.from({ length: Math.max(practice.length, lessons.length) }, (_, index) =>
        [practice[index], lessons[index]].filter((entry) => entry !== undefined),
      ).flat(),
      ...questions.filter((item) => item.reserve).map((item) => item.example),
    ],
    usedSituations: [
      ...new Set([
        ...items.flatMap((item) => getItemSituation(item) ?? []),
        ...lessons.map((entry) => toSituationOpening(entry.question)),
      ]),
    ].slice(0, MAX_MOCK_SITUATIONS),
  };
}

/** Internal workflow bridge: the goal must come from the public boundary that created it. */
export async function loadMockWritingSkills({
  goalId,
  skillIds,
}: {
  goalId: string;
  skillIds: readonly string[];
}): Promise<MockWritingSkill[]> {
  const [goal, rows] = await Promise.all([
    prisma.goal.findUnique({
      select: { details: true, examBlueprint: true, kind: true, userId: true },
      where: { id: goalId },
    }),
    prisma.skill.findMany({
      select: ITEM_WRITING_SKILL_SELECT,
      where: { id: { in: [...skillIds] } },
    }),
  ]);

  if (goal?.kind !== "exam") {
    return [];
  }

  const blueprint = goal.examBlueprint;
  const exam = getGoalItemExam(goal).exam;

  const byId = new Map(rows.map((row) => [row.id, row]));

  return Promise.all(
    skillIds
      .flatMap((id) => byId.get(id) ?? [])
      .filter((skill) => !skill.ownerId || skill.ownerId === goal.userId)
      .map(async (skill) => {
        const [pastQuestions, history] = await Promise.all([
          blueprint
            ? listPastQuestionExamples({
                examBlueprintId: blueprint.id,
                publicOnly: !skill.ownerId && blueprint.visibility === "public",
                skillIds: [skill.id],
              })
            : [],
          loadSkillHistory(
            skill.id,
            skill.ownerId,
            blueprint?.visibility === "private" ? blueprint.id : null,
          ),
        ]);

        return {
          ...skill,
          ...history,
          exam: exam && {
            ...exam,
            name: [exam.name, blueprint?.board].filter(Boolean).join(" — "),
            pastQuestions,
          },
          wrongPenalty: getWrongPenalty(
            blueprint ? readBlueprintContent(blueprint).structure : null,
          ),
        };
      }),
  );
}
