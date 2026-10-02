import "server-only";
import { type MockScopeContext } from "@zoonk/ai/tasks/lessons/question-context";
import { prisma } from "@zoonk/db";
import { getMock } from "../../exams/mocks/get-mock";
import { type MockResult } from "../../exams/mocks/mock-contract";

/** Enough missed questions to see the patterns without flooding the tutor's context. */
const MAX_MISSED_QUESTIONS = 40;

type MockRange = { high: number; low: number } | null;

function toRange(score: { high: number; low: number } | null): MockRange {
  return score ? { high: score.high, low: score.low } : null;
}

function toResult(result: MockResult | null): MockScopeContext["result"] {
  if (!result) {
    return null;
  }

  return {
    blank: result.blank,
    correct: result.correct,
    estimate: toRange(result.irt),
    minutesUsed: result.minutesUsed,
    plannedMinutes: result.plannedMinutes,
    total: result.total,
  };
}

/** Each missed question's skill, by name, so the tutor can say what to practice. */
async function loadSkillNames(itemIds: string[]): Promise<Map<string, string>> {
  const items = await prisma.item.findMany({
    select: { id: true, skill: { select: { name: true } } },
    where: { id: { in: itemIds } },
  });

  return new Map(items.map((item) => [item.id, item.skill.name]));
}

/**
 * The tutor's view of a mock the learner finished, from the same view its result screen shows:
 * the result (an estimated range only where the exam's scoring gives one), each area, the causes
 * of mistakes and the questions they missed with each one's skill.
 */
export async function buildMockContextSnapshot({
  blockId,
  language,
}: {
  blockId: string;
  language: string;
}): Promise<MockScopeContext | null> {
  const result = await getMock(blockId);

  if (result.status !== "ready" || result.mock.status !== "finished") {
    return null;
  }

  const { mock } = result;
  const missed = mock.review.slice(0, MAX_MISSED_QUESTIONS);
  const skills = await loadSkillNames(missed.map((entry) => entry.itemId));

  return {
    areas: (mock.result?.areas ?? []).map((area) => ({
      correct: area.correct,
      estimate: toRange(area.score),
      name: area.name,
      secondsPerQuestion: area.secondsPerQuestion,
      targetSecondsPerQuestion: area.targetSecondsPerQuestion,
      total: area.total,
    })),
    exam: {
      date: mock.date,
      fullLength: mock.fullLength,
      name: mock.examName,
      number: mock.number,
      scoring: mock.scoring,
      scoringNote: mock.scoringNote,
    },
    language,
    missed: missed.map((entry) => ({
      area: entry.area,
      correctAnswer: entry.correctAnswer,
      explanation: entry.explanation,
      learnerAnswer: entry.learnerAnswer,
      number: entry.number,
      outcome: entry.outcome,
      question: entry.question,
      skill: skills.get(entry.itemId) ?? null,
    })),
    mistakeCauses: mock.mistakes.map((mistake) => ({ cause: mistake.cause, count: mistake.count })),
    result: toResult(mock.result),
    scope: { kind: "mock" },
    sections: mock.sections.map((section) => ({
      name: section.name,
      questions: section.questions,
    })),
    version: 1,
  };
}
