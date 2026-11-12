import { type ExamDescription } from "./exam-identity-decision";

/** Only the identifying fields, in one order, so both sides read alike. */
function describeExam(exam: ExamDescription): ExamDescription {
  return { board: exam.board, country: exam.country, name: exam.name, role: exam.role };
}

/** Each side as its own data, so an unknown country stays unknown rather than the other side's. */
export function formatExamIdentityInput({
  candidate,
  request,
}: {
  candidate: ExamDescription;
  request: ExamDescription;
}): { CANDIDATE: string; REQUEST: string } {
  return {
    CANDIDATE: JSON.stringify(describeExam(candidate)),
    REQUEST: JSON.stringify(describeExam(request)),
  };
}
