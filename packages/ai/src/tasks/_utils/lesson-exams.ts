/** An exam the learners who study a lesson prepare for: its name, and how its questions look and score. */
export type LessonExam = { name: string; style: string };

/**
 * `EXAMS` as the lesson planner, writer and reviewer read it: the exams the learners of a shared
 * lesson prepare for, so the lesson is written at their depth and in their questions' style for
 * their candidates, without ever naming them on a screen.
 */
export function formatLessonExams(exams: readonly LessonExam[] = []): string {
  if (exams.length === 0) {
    return "EXAMS: none";
  }

  return `EXAMS:${exams.map((exam) => `\n- ${exam.name}: ${exam.style}`).join("")}`;
}
