import { MS_PER_DAY } from "@zoonk/utils/date";
import { getExtracted, getFormatter } from "next-intl/server";
import { type ExamplePhase } from "./example-road";
import {
  type ExampleCalendar,
  type ExampleGoal,
  type ExampleSet,
  daysBetween,
  getExampleCalendar,
  getExampleSet,
  getGoalDate,
} from "./landing-examples";

/** An example goal as the app's goal switcher shows it, with its plan's phases. */
type ExamplePlan = {
  dailyMinutes: number;
  date: Date;
  /** What the goal's mark is drawn from (`GoalMark`). */
  mark: { id: string; kind: string; targetLanguage: string | null; title: string };
  /** The goal's name in the switcher. */
  name: string;
  phases: readonly ExamplePhase[];
  /** The goal's short name over its plan ("SAT"). */
  shortName: string;
};

type PhaseDays = { end: string; id: string; name: string; start: string };

/** A phase from its first and last days as written, moved to the real calendar. */
function shiftPhase(calendar: ExampleCalendar, { end, id, name, start }: PhaseDays) {
  return { end: calendar.shift(end), id, name, start: calendar.shift(start) };
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/**
 * The ENEM example as written for 26 days to the exam: foundations from 15 days ago to 4 days ago,
 * filling the gaps from 3 days ago to day 10, practice to day 19, the final stretch to the exam.
 * The days after today keep those shares at any distance.
 */
const ENEM_WRITTEN = {
  daysLeft: 26,
  foundationsEnd: -4,
  foundationsStart: -15,
  gapsEnd: 10,
  gapsStart: -3,
  practiceEnd: 19,
};

const ENEM_GAPS_END = ENEM_WRITTEN.gapsEnd / ENEM_WRITTEN.daysLeft;
const ENEM_PRACTICE_END = ENEM_WRITTEN.practiceEnd / ENEM_WRITTEN.daysLeft;

/**
 * The ENEM example's phases against its real date: two weeks of foundations done, today early in
 * filling the gaps, then practice and the final stretch sharing what's left to the exam, so the
 * road always ends on the real day. A phase too near the exam to have a day of its own is left
 * out, as the app's plan leaves it out.
 */
function fitEnemPhases({
  date,
  names,
  today,
}: {
  date: Date;
  names: Record<"finalStretch" | "foundations" | "gaps" | "practice", string>;
  today: Date;
}): ExamplePhase[] {
  const daysLeft = Math.max(daysBetween({ from: today, to: date }), 1);
  const gapsEnd = Math.max(Math.round(daysLeft * ENEM_GAPS_END), 1);
  const practiceEnd = Math.max(Math.round(daysLeft * ENEM_PRACTICE_END), gapsEnd + 1);

  const phases = [
    {
      end: addDays(today, ENEM_WRITTEN.foundationsEnd),
      id: "foundations",
      name: names.foundations,
      start: addDays(today, ENEM_WRITTEN.foundationsStart),
    },
    {
      end: addDays(today, Math.min(gapsEnd, daysLeft)),
      id: "gaps",
      name: names.gaps,
      start: addDays(today, ENEM_WRITTEN.gapsStart),
    },
    {
      end: addDays(today, practiceEnd),
      id: "practice",
      name: names.practice,
      start: addDays(today, gapsEnd + 1),
    },
    { end: date, id: "final", name: names.finalStretch, start: addDays(today, practiceEnd + 1) },
  ];

  return phases.filter((phase) => phase.start <= phase.end && phase.start <= date);
}

/**
 * An exam plan's phases, named by what they're for, as the app names an exam's phases (the plan's
 * phase names, which learn translates): a few weeks of each for the ENEM, months for the SAT.
 */
async function getExamPhases({
  calendar,
  date,
  exam,
}: {
  calendar: ExampleCalendar;
  date: Date;
  exam: ExampleSet["exam"];
}): Promise<ExamplePhase[]> {
  const t = await getExtracted("planPhases");

  const names = {
    finalStretch: t("Final stretch"),
    foundations: t("Foundations"),
    gaps: t("Fill the gaps"),
    practice: t("Practice"),
  };

  if (exam === "enem") {
    return fitEnemPhases({ date, names, today: calendar.today });
  }

  return [
    { end: "2026-10-09", id: "foundations", name: names.foundations, start: "2026-08-31" },
    { end: "2026-11-05", id: "gaps", name: names.gaps, start: "2026-10-10" },
    { end: "2027-01-31", id: "practice", name: names.practice, start: "2026-11-06" },
    { end: "2027-03-13", id: "final", name: names.finalStretch, start: "2027-02-01" },
  ].map((phase) => shiftPhase(calendar, phase));
}

/** A move abroad's phases: the moments of the move, in order. */
async function getMovePhases(calendar: ExampleCalendar): Promise<ExamplePhase[]> {
  const t = await getExtracted("examplePhases");

  return [
    { end: "2026-10-09", id: "arriving", name: t("Arriving"), start: "2026-09-14" },
    { end: "2026-11-20", id: "renting", name: t("Renting a flat"), start: "2026-10-10" },
    { end: "2026-12-18", id: "bank", name: t("Bank and phone"), start: "2026-11-21" },
    { end: "2027-01-29", id: "work", name: t("First week at work"), start: "2026-12-19" },
    { end: "2027-02-12", id: "doctor", name: t("Doctor"), start: "2027-01-30" },
    { end: "2027-03-01", id: "social", name: t("Social life"), start: "2027-02-13" },
  ].map((phase) => shiftPhase(calendar, phase));
}

/**
 * A new job's phases: the skills it asks for, then something to show for them. Example phases
 * have their own namespace, so a word the app also uses (its stats page's "Statistics") can
 * translate as a subject.
 */
async function getJobPhases(calendar: ExampleCalendar): Promise<ExamplePhase[]> {
  const t = await getExtracted("examplePhases");

  return [
    { end: "2026-10-09", id: "spreadsheets", name: t("Spreadsheets"), start: "2026-08-24" },
    { end: "2026-12-04", id: "sql", name: t("SQL"), start: "2026-10-10" },
    { end: "2027-02-12", id: "statistics", name: t("Statistics"), start: "2026-12-05" },
    { end: "2027-04-16", id: "dashboards", name: t("Dashboards"), start: "2027-02-13" },
    { end: "2027-06-10", id: "portfolio", name: t("Portfolio"), start: "2027-04-17" },
  ].map((phase) => shiftPhase(calendar, phase));
}

/**
 * The landing's three example goals in the page's language, each as the goal switcher lists it,
 * with its plan's phases: the hero's road and the "Every day" stop's plan change read them.
 */
export async function getExamplePlans(): Promise<Record<ExampleGoal, ExamplePlan>> {
  const t = await getExtracted();
  const format = await getFormatter();
  const set = await getExampleSet();
  const calendar = await getExampleCalendar();

  const dates = {
    exam: getGoalDate({ calendar, goal: "exam", set }),
    job: getGoalDate({ calendar, goal: "job", set }),
    move: getGoalDate({ calendar, goal: "move", set }),
  };

  const examPhases = await getExamPhases({ calendar, date: dates.exam, exam: set.exam });
  const movePhases = await getMovePhases(calendar);
  const jobPhases = await getJobPhases(calendar);
  const month = (date: Date) => format.dateTime(date, { month: "long", timeZone: "UTC" });

  const examName =
    set.exam === "enem"
      ? t("ENEM in {month}", { month: month(dates.exam) })
      : t("SAT in {month}", { month: month(dates.exam) });

  const moveName = set.move === "madrid" ? t("Spanish for Madrid") : t("English for London");
  const jobName = t("Data analyst by {month}", { month: month(dates.job) });

  return {
    exam: {
      dailyMinutes: 25,
      date: dates.exam,
      mark: { id: "example-exam", kind: "exam", targetLanguage: null, title: examName },
      name: examName,
      phases: examPhases,
      shortName: set.exam === "enem" ? t("ENEM") : t("SAT"),
    },
    job: {
      dailyMinutes: 20,
      date: dates.job,
      mark: { id: "example-job", kind: "learn", targetLanguage: null, title: jobName },
      name: jobName,
      phases: jobPhases,
      shortName: t("Data analyst"),
    },
    move: {
      dailyMinutes: 30,
      date: dates.move,
      // Spanish shows Spain's flag. English would show the US's, not London's, so the London
      // goal keeps its letter.
      mark: {
        id: "example-move",
        kind: set.move === "madrid" ? "language" : "learn",
        targetLanguage: set.move === "madrid" ? "es" : null,
        title: moveName,
      },
      name: moveName,
      phases: movePhases,
      shortName: moveName,
    },
  };
}
