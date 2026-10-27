import { isObjectiveSection, isQuestionSubject } from "../../exams/mocks/written-subject";
import { type BlueprintContent } from "./blueprint-contract";
import { isObjectiveFormat } from "./format-shares";

/** Whether the reading states that the exam asks objective questions, in any of the ways it can. */
function statesObjectiveQuestions({ edition, structure }: BlueprintContent): boolean {
  const sections = structure.mock?.sections ?? [];

  return (
    edition.questionCount !== null ||
    (structure.mock?.totalQuestions ?? null) !== null ||
    sections.some((section) => section.questions && isObjectiveSection(section)) ||
    structure.formats.some((format) => isObjectiveFormat(format.kind))
  );
}

/**
 * Whether the reading states an objective test (its questions, an objective section, or a format
 * such as multiple choice) yet keeps none of the subjects it asks, only written tests such as an
 * essay: the documents read didn't list them. TJ-SP's notice couldn't be downloaded, so research read
 * the court's news page, which gives the objective test's 70 questions and no subject, and the
 * essay became the exam's only subject, on the exam page and in its mocks.
 */
export function isObjectiveTestUnread(content: BlueprintContent): boolean {
  const { subjects } = content.structure;

  return (
    subjects.length > 0 &&
    !subjects.some((subject) => isQuestionSubject({ structure: content.structure, subject })) &&
    statesObjectiveQuestions(content)
  );
}
