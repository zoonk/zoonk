import "server-only";
import { prisma } from "@zoonk/db";
import { gradeTypedItemAnswer } from "../../../learner/_utils/typed-grading";
import { recordLearnerAnswer } from "../../../learner/record-learner-answer";
import { scheduleMistakeCause } from "../../../mistakes/resolve-mistake-cause";
import { getPickOutcome } from "../../scoring/partial-credit";
import { type GradedMockAnswer } from "../mock-analysis";
import { type MockAnswer } from "../mock-answer-contract";
import { readMockAnswer } from "./mock-answers";
import { type MockItemGrade, gradeMockItem } from "./mock-item-grading";
import { type MockItem, loadMockItems } from "./mock-items";
import { getAskedItemIds } from "./mock-sections";
import { type MockSitting } from "./owned-mock";

const MS_PER_MINUTE = 60_000;

type AskedQuestion = {
  answer: MockAnswer | null;
  durationMs: number;
  flagged: boolean;
  item: MockItem;
  section: number;
};

type GradedQuestion = AskedQuestion & { grade: MockItemGrade };

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
function isDiagnostic({ grade, mock }: { grade: MockItemGrade; mock: MockSitting }) {
  return !grade.answered || mock.conditions.purpose === "placement";
}

async function recordAnswer({
  graded,
  mock,
  sessionId,
  timeZone,
}: {
  graded: GradedQuestion;
  mock: MockSitting;
  sessionId: string | null;
  timeZone: string;
}) {
  const { durationMs, grade, item } = graded;
  const paceMs = getPaceMs({ mock, section: graded.section });
  const diagnostic = isDiagnostic({ grade, mock });

  const recorded = await recordLearnerAnswer({
    answer: grade.recorded,
    graded: { durationMs, expectedDurationMs: paceMs ?? undefined, isCorrect: grade.isCorrect },
    itemId: item.id,
    language: item.language,
    mistake:
      grade.answered && !diagnostic
        ? { questionText: grade.snapshot.question, snapshot: grade.snapshot, timeLimitMs: paceMs }
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
 * Grades a question: by code, and a typed answer code doesn't accept by a model too, since it
 * may be right in other words (capped per question and day). One recorded already (a finish that
 * stopped halfway) keeps the verdict it was recorded with.
 */
async function gradeAsked({
  asked,
  mock,
  recorded,
}: {
  asked: AskedQuestion;
  mock: MockSitting;
  recorded: ReadonlyMap<string, boolean>;
}): Promise<GradedQuestion> {
  const { item } = asked;

  const grade = gradeMockItem({
    answer: asked.answer,
    item,
    mockId: mock.id,
    partialCredit: mock.conditions.partialCredit,
  });

  if (item.format !== "typed" || !grade.answered || grade.isCorrect) {
    return { ...asked, grade };
  }

  const text = asked.answer && "text" in asked.answer ? asked.answer.text : "";

  const verdict = recorded.has(item.id)
    ? { isCorrect: recorded.get(item.id) === true }
    : await gradeTypedItemAnswer({ item, text, userId: mock.userId });

  return {
    ...asked,
    grade: { ...grade, credit: Number(verdict.isCorrect), isCorrect: verdict.isCorrect },
  };
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
    ? asked.filter((question) => question.answer !== null)
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

  const [items, attempts] = await Promise.all([
    /** Handed-in questions become notebook entries: recordings keep their revealed review support. */
    loadMockItems(itemIds, { reveal: true }),
    prisma.attempt.findMany({
      select: { isCorrect: true, itemId: true },
      where: { mockExamId: mock.id },
    }),
  ]);

  const recorded = new Map(
    attempts.flatMap((attempt) =>
      attempt.itemId ? [[attempt.itemId, attempt.isCorrect] as const] : [],
    ),
  );

  const allAsked = askedIds.flatMap((entry): AskedQuestion[] => {
    const item = items.get(entry.itemId);
    const draft = mock.answers.find((answer) => answer.itemId === entry.itemId);

    return item
      ? [
          {
            answer: readMockAnswer(draft?.answer),
            durationMs: draft?.durationMs ?? 0,
            flagged: draft?.flagged ?? false,
            item,
            section: entry.section,
          },
        ]
      : [];
  });

  // Typed answers a model grades are independent of each other, so they're graded at once.
  const graded = await Promise.all(
    getGradedQuestions({ asked: allAsked, mock }).map((asked) =>
      gradeAsked({ asked, mock, recorded }),
    ),
  );

  await graded
    .filter((question) => !recorded.has(question.item.id))
    .reduce(
      (previous, question) =>
        previous.then(() => recordAnswer({ graded: question, mock, sessionId, timeZone })),
      Promise.resolve(),
    );

  const skillNames = await loadSkillNames(graded.map((question) => question.item.skillId));

  return graded.map((question) => toGraded({ areas, mock, question, skillNames }));
}

/** Each topic's name, so the result can say how each went. */
async function loadSkillNames(skillIds: readonly string[]): Promise<Map<string, string>> {
  const skills = await prisma.skill.findMany({
    select: { id: true, name: true },
    where: { id: { in: [...new Set(skillIds)] } },
  });

  return new Map(skills.map((skill) => [skill.id, skill.name]));
}

function toGraded({
  areas,
  mock,
  question,
  skillNames,
}: {
  areas: Map<string, string>;
  mock: MockSitting;
  question: GradedQuestion;
  skillNames: ReadonlyMap<string, string>;
}): GradedMockAnswer {
  const { grade, item, section } = question;
  const outcome = getPickOutcome({ answered: grade.answered, credit: grade.credit });

  return {
    area: areas.get(item.skillId) ?? null,
    credit: grade.credit,
    durationMs: question.durationMs,
    flagged: question.flagged,
    irtItem: item.irt,
    outcome,
    section,
    skill: { id: item.skillId, name: skillNames.get(item.skillId) ?? "" },
    timedOut: outcome === "blank" && mock.conditions.timedOutSections.includes(section),
  };
}
