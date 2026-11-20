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

export function getScheduledWrittenTest({
  calendar,
  excludes,
  planStart,
  structure,
  targetDate,
  today,
}: {
  calendar: StudyCalendar;
  excludes: ReadonlySet<string>;
  planStart: Date;
  structure: ExamStructure | null;
  targetDate: Date | null;
  today: Date;
}): { day: number | null; minutes: number; title: string } | null {
  if (!targetDate || !structure || today >= targetDate) {
    return null;
  }

  const sections = structure.mock?.sections.filter(({ kind }) => kind === "written") ?? [];
  const papers = [...Map.groupBy(sections, (section) => section.day)];

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
    papers.flatMap(([day, written]) => {
      const tasks = listWrittenTasks({ day, structure });
      const minutes = written.reduce((sum, section) => sum + (section.minutes ?? 0), 0);

      const official =
        tasks.length > 0 && tasks.every((task) => task.minutes !== null) && minutes > 0;

      const dates = official
        ? pickWrittenTestDays({ sectionMinutes: minutes, studyDays, targetDate })
        : [];

      return dates.includes(toIsoDate(today))
        ? [{ day, minutes, title: written.map(({ name }) => name).join(" / ") }]
        : [];
    })[0] ?? null
  );
}
