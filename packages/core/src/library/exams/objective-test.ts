import { isObjectiveSection, isQuestionSubject } from "../../exams/mocks/written-subject";
import { type BlueprintContent } from "./blueprint-contract";
import { isObjectiveFormat } from "./format-shares";

function statesObjectiveQuestions({ edition, structure }: BlueprintContent): boolean {
  const sections = structure.mock?.sections ?? [];

  return (
    edition.questionCount !== null ||
    (structure.mock?.totalQuestions ?? null) !== null ||
    sections.some((section) => section.questions && isObjectiveSection(section)) ||
    structure.formats.some((format) => isObjectiveFormat(format.kind))
  );
}

export function isObjectiveTestUnread(content: BlueprintContent): boolean {
  const { subjects } = content.structure;

  return (
    subjects.length > 0 &&
    !subjects.some((subject) => isQuestionSubject({ structure: content.structure, subject })) &&
    statesObjectiveQuestions(content)
  );
}
