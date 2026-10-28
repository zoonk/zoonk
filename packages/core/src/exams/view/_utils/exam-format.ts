import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { type ExamDay, type ExamFormatDay } from "../exam-view-contract";

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
