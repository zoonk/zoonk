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

type ExamplePlan = {
  dailyMinutes: number;
  date: Date;
  mark: { id: string; kind: string; targetLanguage: string | null; title: string };
  name: string;
  phases: readonly ExamplePhase[];
  shortName: string;
};

type PhaseDays = { end: string; id: string; name: string; start: string };

function shiftPhase(calendar: ExampleCalendar, { end, id, name, start }: PhaseDays) {
  return { end: calendar.shift(end), id, name, start: calendar.shift(start) };
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

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

/** Example phases have their own namespace, so a word the app also uses can translate as a subject. */
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
