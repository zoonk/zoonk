import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { getPastQuestionsSource, getSubjectQuestions } from "../../library/exams/subject-questions";
import { getFormatMixSource } from "./mock-format-mix";
import { findExamQuestions } from "./mock-structure";
import { type MockSizeSource } from "./mock-view-contract";
import { isQuestionSubject } from "./written-subject";

function getSubjectsSource(structure: ExamStructure): MockSizeSource["subjects"] {
  const objective = structure.subjects.filter((subject) =>
    isQuestionSubject({ structure, subject }),
  );

  if (objective.length <= 1) {
    return null;
  }

  if (objective.some((subject) => subject.questions !== null)) {
    return "notice";
  }

  return objective.some((subject) => getSubjectQuestions({ structure, subject }))
    ? "pastEdition"
    : "even";
}

/** Whether the notice states the exam's time: its total, or every section's. */
function isTimeStated(structure: ExamStructure): boolean {
  const sections = structure.mock?.sections ?? [];

  return (
    Boolean(structure.mock?.timeLimitMinutes) ||
    (sections.length > 0 && sections.every((section) => section.minutes))
  );
}

/** Where the mocks of an exam take their size from (see `MockSizeSource`). */
export function getMockSizeSource({
  noticeQuestions,
  ownerId,
  structure,
}: {
  noticeQuestions: number | null;
  ownerId: string | null;
  structure: ExamStructure;
}): MockSizeSource {
  const material = ownerId !== null;
  const found = findExamQuestions({ noticeQuestions, structure });
  const subjects = getSubjectsSource(structure);
  const fromPast = found?.source === "pastEdition" || subjects === "pastEdition";

  return {
    formats: getFormatMixSource(structure),
    material,
    pastEdition: fromPast ? getPastQuestionsSource(structure) : null,
    questions: found?.source ?? "unstated",
    subjects,
    time: isTimeStated(structure) ? "notice" : "unstated",
  };
}
