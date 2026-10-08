import "server-only";
import { type ExamFactsContext } from "@zoonk/ai/tasks/lessons/question-context";
import { type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { type BlueprintContent } from "../../library/exams/blueprint-contract";
import { readBlueprintContent } from "../../library/exams/save-exam-blueprint";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { getExamEditionDays, readExamMonth, readExamYear } from "./exam-edition-days";

/** Rules beyond these are the exam room's (pens, gates); the ones that decide the result come first. */
const MAX_RULES = 8;
const MAX_FORMATS = 4;
const MAX_TEXT = 240;

type FactsGoal = Pick<Goal, "createdAt" | "details" | "examBlueprintId" | "kind" | "timezone">;

function shorten(text: string): string {
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1)}…` : text;
}

/** The notice's dates that aren't exam days: registration, results, a later phase. */
function getOtherDates(content: BlueprintContent): ExamFactsContext["otherDates"] {
  return content.edition.dates
    .filter((date) => date.kind !== "exam")
    .toSorted((first, second) => first.date.localeCompare(second.date))
    .map((date) => ({ date: date.date, label: date.label }));
}

function toFacts({
  blueprint,
  goal,
}: {
  blueprint: ExamBlueprint;
  goal: FactsGoal;
}): ExamFactsContext {
  const content = readBlueprintContent(blueprint);
  const { edition, structure } = content;

  const today = toIsoDate(
    getDateInTimeZone({ date: new Date(), timeZone: getAnswerTimeZone({ goal }) }),
  );

  const { days, estimated } = getExamEditionDays({
    edition,
    examMonth: readExamMonth(goal.details),
    examYear: readExamYear(goal.details),
    from: today,
  });

  // A class test read from the learner's own material has no notice: its day is never official.
  const fromMaterial = blueprint.ownerId !== null;

  return {
    days: days.map((day) => ({ date: day.date, label: day.label })),
    formats: structure.formats.slice(0, MAX_FORMATS).map((format) => shorten(format.description)),
    fromMaterial,
    name: blueprint.name,
    official: days.length > 0 && !estimated && !fromMaterial,
    otherDates: estimated ? [] : getOtherDates(content),
    questionCount: edition.questionCount ?? structure.mock?.totalQuestions ?? null,
    rules: structure.rules.slice(0, MAX_RULES).map((rule) => shorten(rule.text)),
    scoring: structure.mock?.scoring.description ?? null,
    source: edition.noticeUrl,
    subjects: structure.subjects.map((subject) => ({
      group: subject.group ?? null,
      name: subject.name,
      questions: subject.questions,
    })),
  };
}

/**
 * What an exam goal's stored notice says: its exam days (official, or the likely ones until the
 * notice for the learner's edition is out) with the notice's address, its other dates, how it's
 * scored, the rules that decide the result and its subjects. For a class test read from the
 * learner's own material (`fromMaterial`), what that material says, with no official day. Null
 * for other goals and exams without a stored notice.
 */
export async function loadExamNoticeFacts(goal: FactsGoal): Promise<ExamFactsContext | null> {
  if (goal.kind !== "exam" || !goal.examBlueprintId) {
    return null;
  }

  const blueprint = await prisma.examBlueprint.findUnique({ where: { id: goal.examBlueprintId } });

  return blueprint ? toFacts({ blueprint, goal }) : null;
}

/** The official exam day a new goal date moves away from, with where it's set. */
export type OfficialExamDate = { date: string; source: string | null };

/**
 * The exam day the notice officially sets, when `targetDate` isn't one of its days: moving the
 * goal there contradicts the notice, so the learner is told the official day and keeps their own
 * only on purpose. Null when the date is one of them, the days are only estimated, or there's no
 * notice.
 */
export function findOfficialDateConflict({
  facts,
  targetDate,
}: {
  facts: ExamFactsContext | null;
  targetDate: string | null;
}): OfficialExamDate | null {
  if (!facts?.official || !targetDate || facts.days.some((day) => day.date === targetDate)) {
    return null;
  }

  const [first] = facts.days;
  return first ? { date: first.date, source: facts.source } : null;
}
