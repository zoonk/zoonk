import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { type ExamDay, type ExamFormatDay } from "../exam-view-contract";

/**
 * The exam as its notice sets it out, day by day: each sitting's date (from the exam's calendar),
 * its time and its parts (ENEM's day 1: "Languages, Human Sciences and essay", 90 questions,
 * 5 h 30). A section the notice doesn't place on a day sits on the first. Empty when the notice
 * doesn't state its sections, so the page says nothing it can't source.
 */
export function getExamFormat({
  days,
  structure,
}: {
  days: readonly ExamDay[];
  structure: ExamStructure | null;
}): ExamFormatDay[] {
  const sections = structure?.mock?.sections ?? [];

  if (sections.length === 0) {
    return [];
  }

  const numbers = [...new Set(sections.map((section) => section.day ?? 1))].toSorted(
    (a, b) => a - b,
  );

  return numbers.map((day) => {
    const daySections = sections.filter((section) => (section.day ?? 1) === day);
    const minutes = daySections.map((section) => section.minutes);

    return {
      date: days[day - 1]?.date ?? null,
      day,
      minutes: minutes.every((value) => value !== null)
        ? minutes.reduce<number>((sum, value) => sum + (value ?? 0), 0)
        : null,
      parts: daySections.map((section) => ({
        name: section.name,
        questions: section.questions,
        written: section.kind === "written",
      })),
    };
  });
}
