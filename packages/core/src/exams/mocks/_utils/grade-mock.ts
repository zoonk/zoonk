import "server-only";
import { prisma } from "@zoonk/db";
import { type JsonObject } from "@zoonk/utils/json";
import { getQuestionText, gradeChoiceAnswer } from "../../../learner/_utils/choice-items";
import { recordLearnerAnswer } from "../../../learner/record-learner-answer";
import { scheduleMistakeCause } from "../../../mistakes/resolve-mistake-cause";
import { type GradedMockAnswer } from "../mock-analysis";
import { type MockChoice, readMockChoice } from "../mock-contract";
import { type MockItem, loadMockItems } from "./mock-items";
import { getAskedItemIds } from "./mock-sections";
import { type MockSitting } from "./owned-mock";

const BLANK = { dontKnow: true } as const;
const MS_PER_MINUTE = 60_000;

type AskedQuestion = {
  choice: MockChoice | null;
  durationMs: number;
  flagged: boolean;
  item: MockItem;
  section: number;
};

/** The exam's pace for a section, so a slow answer reads as the time the exam allows. */
function getPaceMs({ mock, section }: { mock: MockSitting; section: number }): number | null {
  const conditions = mock.conditions.sections[section];

  return conditions && conditions.questions > 0
    ? (conditions.minutes * MS_PER_MINUTE) / conditions.questions
    : null;
}

async function recordAnswer({
  asked,
  mock,
  sessionId,
  timeZone,
}: {
  asked: AskedQuestion;
  mock: MockSitting;
  sessionId: string;
  timeZone: string;
}) {
  const { choice, durationMs, item } = asked;
  const answer: JsonObject = choice ?? BLANK;
  const graded = gradeChoiceAnswer({ answer: choice ?? BLANK, item });
  const paceMs = getPaceMs({ mock, section: asked.section });

  const recorded = await recordLearnerAnswer({
    answer,
    graded: { durationMs, expectedDurationMs: paceMs ?? undefined, isCorrect: graded.isCorrect },
    itemId: item.id,
    language: item.language,
    mistake: choice
      ? { questionText: getQuestionText(item), snapshot: graded.snapshot, timeLimitMs: paceMs }
      : null,
    mockExamId: mock.id,
    // A question left blank says the learner didn't know it; it isn't a mistake in the notebook.
    purpose: choice ? "learning" : "diagnostic",
    skillId: item.skillId,
    studySessionId: sessionId,
    timeZone,
    userId: mock.userId,
  });

  scheduleMistakeCause(recorded.causeRequest);
}

/**
 * Grades every question the mock asked and records it in the learner model, one after another so
 * two answers on the same skill update its memory in order. Questions left blank count as not
 * known. Answers already recorded (a finish that stopped halfway) aren't recorded again, and the
 * database keeps one attempt per mock question.
 */
export async function gradeMock({
  areas,
  mock,
  sessionId,
  timeZone,
}: {
  areas: Map<string, string>;
  mock: MockSitting;
  sessionId: string;
  timeZone: string;
}): Promise<GradedMockAnswer[]> {
  const askedIds = getAskedItemIds(mock.conditions);
  const itemIds = askedIds.map((entry) => entry.itemId);

  const [items, recorded] = await Promise.all([
    loadMockItems(itemIds),
    prisma.attempt.findMany({ select: { itemId: true }, where: { mockExamId: mock.id } }),
  ]);

  const recordedIds = new Set(recorded.map((attempt) => attempt.itemId));

  const asked = askedIds.flatMap((entry): AskedQuestion[] => {
    const item = items.get(entry.itemId);
    const draft = mock.answers.find((answer) => answer.itemId === entry.itemId);

    return item
      ? [
          {
            choice: readMockChoice(draft?.answer),
            durationMs: draft?.durationMs ?? 0,
            flagged: draft?.flagged ?? false,
            item,
            section: entry.section,
          },
        ]
      : [];
  });

  await asked
    .filter((question) => !recordedIds.has(question.item.id))
    .reduce(
      (previous, question) =>
        previous.then(() => recordAnswer({ asked: question, mock, sessionId, timeZone })),
      Promise.resolve(),
    );

  return asked.map((question) => toGraded({ areas, mock, question }));
}

function getOutcome({
  choice,
  item,
}: {
  choice: MockChoice | null;
  item: MockItem;
}): GradedMockAnswer["outcome"] {
  if (!choice) {
    return "blank";
  }

  return gradeChoiceAnswer({ answer: choice, item }).isCorrect ? "right" : "wrong";
}

function toGraded({
  areas,
  mock,
  question,
}: {
  areas: Map<string, string>;
  mock: MockSitting;
  question: AskedQuestion;
}): GradedMockAnswer {
  const { choice, item, section } = question;
  const outcome = getOutcome({ choice, item });

  return {
    area: areas.get(item.skillId) ?? null,
    durationMs: question.durationMs,
    flagged: question.flagged,
    irtItem: item.irt,
    outcome,
    section,
    timedOut: outcome === "blank" && mock.conditions.timedOutSections.includes(section),
  };
}
