import "server-only";
import { type ExamFactsContext } from "@zoonk/ai/tasks/lessons/question-context";
import { type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { type BlueprintContent } from "../../library/exams/blueprint-contract";
import { readBlueprintContent } from "../../library/exams/save-exam-blueprint";
import { getPastQuestionsSource, getSubjectQuestions } from "../../library/exams/subject-questions";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { type ExamChoice, toChosenStructure } from "../choices/exam-choices";
import { loadExamChoices } from "../choices/load-exam-choices";
import { getExamEditionDays, readExamMonth, readExamYear } from "./exam-edition-days";
import { findLearnerSitting } from "./exam-sittings";

const MAX_RULES = 8;
const MAX_FORMATS = 4;
const MAX_TEXT = 240;

type FactsGoal = Pick<
  Goal,
  "createdAt" | "details" | "examBlueprintId" | "id" | "kind" | "timezone"
>;

function shorten(text: string): string {
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1)}…` : text;
}

function getOtherDates(content: BlueprintContent): ExamFactsContext["otherDates"] {
  return content.edition.dates
    .filter((date) => date.kind !== "exam")
    .toSorted((first, second) => first.date.localeCompare(second.date))
    .map((date) => ({ date: date.date, label: date.label }));
}

type Structure = BlueprintContent["structure"];

function toSubject({
  structure,
  subject,
}: {
  structure: Structure;
  subject: Structure["subjects"][number];
}): ExamFactsContext["subjects"][number] {
  const questions = getSubjectQuestions({ structure, subject });
  const fromLatestEdition = subject.questions === null && questions !== null;

  return {
    group: subject.group ?? null,
    name: subject.name,
    questions,
    ...(fromLatestEdition ? { fromLatestEdition } : {}),
  };
}

function toQuestionsSource(structure: Structure): Pick<ExamFactsContext, "questionsSource"> {
  const source = getPastQuestionsSource(structure);
  return { questionsSource: source };
}

function toFacts({
  blueprint,
  choices,
  goal,
}: {
  blueprint: ExamBlueprint;
  choices: readonly ExamChoice[];
  goal: FactsGoal;
}): ExamFactsContext {
  const content = readBlueprintContent(blueprint);
  const { edition } = content;
  const structure = toChosenStructure({ choices, structure: content.structure });

  const today = toIsoDate(
    getDateInTimeZone({ date: new Date(), timeZone: getAnswerTimeZone({ goal }) }),
  );

  const { days, estimated } = getExamEditionDays({
    edition,
    examMonth: readExamMonth(goal.details),
    examYear: readExamYear(goal.details),
    from: today,
  });

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
    subjects: structure.subjects.map((subject) => toSubject({ structure, subject })),
    ...toQuestionsSource(structure),
  };
}

export async function loadExamNoticeFacts(goal: FactsGoal): Promise<ExamFactsContext | null> {
  if (goal.kind !== "exam" || !goal.examBlueprintId) {
    return null;
  }

  const [blueprint, choices] = await Promise.all([
    prisma.examBlueprint.findUnique({ where: { id: goal.examBlueprintId } }),
    loadExamChoices(goal.id),
  ]);

  return blueprint ? toFacts({ blueprint, choices, goal }) : null;
}

export type OfficialExamDate = { date: string; source: string | null };

export function findOfficialDateConflict({
  facts,
  targetDate,
  today,
}: {
  facts: ExamFactsContext | null;
  targetDate: string | null;
  today: string;
}): OfficialExamDate | null {
  if (!facts?.official || !targetDate || facts.days.some((day) => day.date === targetDate)) {
    return null;
  }

  const sitting = findLearnerSitting({ days: facts.days, from: today, goalDate: targetDate });
  const [first] = sitting ?? [];

  return first ? { date: first.date, source: facts.source } : null;
}
