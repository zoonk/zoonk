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

/**
 * A mock taken as placement measures what the learner already knows, like placement's own
 * questions: nothing it asks goes to the mistakes notebook.
 */
function isDiagnostic({ choice, mock }: { choice: MockChoice | null; mock: MockSitting }) {
  return !choice || mock.conditions.purpose === "placement";
}

async function recordAnswer({
  asked,
  mock,
  sessionId,
  timeZone,
}: {
  asked: AskedQuestion;
  mock: MockSitting;
  sessionId: string | null;
  timeZone: string;
}) {
  const { choice, durationMs, item } = asked;
  const answer: JsonObject = choice ?? BLANK;
  const graded = gradeChoiceAnswer({ answer: choice ?? BLANK, item });
  const paceMs = getPaceMs({ mock, section: asked.section });
  const diagnostic = isDiagnostic({ choice, mock });

  const recorded = await recordLearnerAnswer({
    answer,
    graded: { durationMs, expectedDurationMs: paceMs ?? undefined, isCorrect: graded.isCorrect },
    itemId: item.id,
    language: item.language,
    mistake:
      choice && !diagnostic
        ? { questionText: getQuestionText(item), snapshot: graded.snapshot, timeLimitMs: paceMs }
        : null,
    mockExamId: mock.id,
    // A question left blank says the learner didn't know it; it isn't a mistake in the notebook.
    purpose: diagnostic ? "diagnostic" : "learning",
    skillId: item.skillId,
    studySessionId: sessionId,
    timeZone,
    userId: mock.userId,
  });

  scheduleMistakeCause(recorded.causeRequest);
}

/**
 * The questions a mock grades: every one it asked, or for a mock taken as placement, only the
 * ones the learner answered. Stopping it midway keeps what they answered, and questions they never
 * got to say nothing about what they know.
 */
function getGradedQuestions({
  asked,
  mock,
}: {
  asked: AskedQuestion[];
  mock: MockSitting;
}): AskedQuestion[] {
  return mock.conditions.purpose === "placement"
    ? asked.filter((question) => question.choice !== null)
    : asked;
}

/**
 * Grades every question the mock asked and records it in the learner model, one after another so
 * two answers on the same skill update its memory in order. Questions left blank count as not
 * known, except in a mock taken as placement, which grades only the answered ones. Answers
 * already recorded (a finish that stopped halfway) aren't recorded again, and the database keeps
 * one attempt per mock question.
 */
export async function gradeMock({
  areas,
  mock,
  sessionId,
  timeZone,
}: {
  areas: Map<string, string>;
  mock: MockSitting;
  /** The session a scheduled mock was played in; null for a mock taken any time. */
  sessionId: string | null;
  timeZone: string;
}): Promise<GradedMockAnswer[]> {
  const askedIds = getAskedItemIds(mock.conditions);
  const itemIds = askedIds.map((entry) => entry.itemId);

  const [items, recorded] = await Promise.all([
    loadMockItems(itemIds),
    prisma.attempt.findMany({ select: { itemId: true }, where: { mockExamId: mock.id } }),
  ]);

  const recordedIds = new Set(recorded.map((attempt) => attempt.itemId));

  const allAsked = askedIds.flatMap((entry): AskedQuestion[] => {
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

  const asked = getGradedQuestions({ asked: allAsked, mock });

  await asked
    .filter((question) => !recordedIds.has(question.item.id))
    .reduce(
      (previous, question) =>
        previous.then(() => recordAnswer({ asked: question, mock, sessionId, timeZone })),
      Promise.resolve(),
    );

  const skillNames = await loadSkillNames(asked.map((question) => question.item.skillId));

  return asked.map((question) => toGraded({ areas, mock, question, skillNames }));
}

/** Each topic's name, so the result can say how each went. */
async function loadSkillNames(skillIds: readonly string[]): Promise<Map<string, string>> {
  const skills = await prisma.skill.findMany({
    select: { id: true, name: true },
    where: { id: { in: [...new Set(skillIds)] } },
  });

  return new Map(skills.map((skill) => [skill.id, skill.name]));
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
  skillNames,
}: {
  areas: Map<string, string>;
  mock: MockSitting;
  question: AskedQuestion;
  skillNames: ReadonlyMap<string, string>;
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
    skill: { id: item.skillId, name: skillNames.get(item.skillId) ?? "" },
    timedOut: outcome === "blank" && mock.conditions.timedOutSections.includes(section),
  };
}
