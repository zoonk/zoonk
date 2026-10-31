export type LessonExam = { name: string; style: string };

export function formatLessonExams(exams: readonly LessonExam[] = []): string {
  if (exams.length === 0) {
    return "EXAMS: none";
  }

  return `EXAMS:${exams.map((exam) => `\n- ${exam.name}: ${exam.style}`).join("")}`;
}
