import { type ExamPicks } from "../../exams/choices/exam-choices";
import { getWritingScope } from "../../exams/essays/_utils/writing-scope";
import { pickWrittenTestDays } from "../../exams/mocks/written-test-schedule";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { listWrittenTasks } from "../../library/exams/written-tasks";
import {
  type StudyCalendar,
  addDays,
  daysBetween,
  getStudyMinutes,
  toIsoDate,
} from "./plan-calendar";

export function listWrittenPapers({
  picks,
  structure,
}: {
  picks: ExamPicks;
  structure: ExamStructure;
}) {
  const sections = structure.mock?.sections.filter(({ kind }) => kind === "written") ?? [];

  return [...Map.groupBy(sections, (section) => section.day)].flatMap(([day, written]) => {
    const tasks = listWrittenTasks({ day, structure });
    const minutes = written.reduce((sum, section) => sum + (section.minutes ?? 0), 0);

    const official =
      tasks.length > 0 &&
      minutes > 0 &&
      tasks.every(
        (task) => task.minutes !== null && getWritingScope({ picks, structure, task }).available,
      );

    return official
      ? [{ day, minutes, tasks, title: written.map(({ name }) => name).join(" / ") }]
      : [];
  });
}

export function scheduleWrittenPapers<Paper extends { minutes: number }>({
  studyDays,
  targetDate,
  tests,
}: {
  studyDays: readonly { date: string; minutes: number }[];
  targetDate: Date;
  tests: readonly Paper[];
}): Map<string, Paper> {
  const schedule = new Map<string, Paper>();

  for (const paper of tests) {
    const dates = pickWrittenTestDays({
      sectionMinutes: paper.minutes,
      studyDays: studyDays.filter(({ date }) => !schedule.has(date)),
      targetDate,
    });

    for (const date of dates) {
      schedule.set(date, paper);
    }
  }

  return schedule;
}

export function getScheduledWrittenTest({
  calendar,
  excludes,
  picks,
  planStart,
  structure,
  targetDate,
  today,
}: {
  calendar: StudyCalendar;
  excludes: ReadonlySet<string>;
  picks: ExamPicks;
  planStart: Date;
  structure: ExamStructure | null;
  targetDate: Date | null;
  today: Date;
}): { day: number | null; minutes: number; title: string } | null {
  if (!targetDate || !structure || today >= targetDate) {
    return null;
  }

  const papers = listWrittenPapers({ picks, structure });

  if (papers.length === 0) {
    return null;
  }

  const studyDays = Array.from(
    { length: Math.max(0, daysBetween(planStart, targetDate)) },
    (_, offset) => {
      const date = addDays(planStart, offset);
      const label = toIsoDate(date);

      return {
        date: label,
        minutes: excludes.has(label) ? 0 : getStudyMinutes({ calendar, date }),
      };
    },
  );

  return (
    scheduleWrittenPapers({ studyDays, targetDate, tests: papers }).get(toIsoDate(today)) ?? null
  );
}
