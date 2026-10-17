import "server-only";
import { type ExamBlueprint } from "@zoonk/db";
import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import { type ExamChoice, toChosenStructure } from "../../choices/exam-choices";
import { getMockSizeSource } from "../mock-size-source";
import { toMockStructure } from "../mock-structure";
import { type MockSizeSource } from "../mock-view-contract";

/** A mock of an exam with no notice nor material: its length and time are the app's own. */
const UNSTATED_SIZE: MockSizeSource = {
  formats: null,
  material: false,
  pastEdition: null,
  questions: "unstated",
  subjects: null,
  time: "unstated",
};

/**
 * The structure a blueprint's mocks copy (see `toMockStructure`) as this learner takes the exam:
 * only the options they picked of its choices (`choices`, see `toChosenStructure`), sized by its
 * notice's edition or a past edition where the reading left the mock without a size, or a class
 * test's short test fitted to the mock day's time (`dayMinutes`).
 */
export function readMockStructure({
  blueprint,
  choices,
  dayMinutes,
}: {
  blueprint: ExamBlueprint;
  /** The learner's picks for the exam's choices, from their plan's settings. */
  choices: readonly ExamChoice[];
  dayMinutes?: number | null;
}): ExamStructure {
  const { edition, structure } = readBlueprintContent(blueprint);

  return toMockStructure({
    dayMinutes,
    noticeQuestions: edition.questionCount,
    ownerId: blueprint.ownerId,
    structure: toChosenStructure({ choices, structure }),
  });
}

/** Where a blueprint's mocks take their size from, to say on them (see `MockSizeSource`). */
export function readMockSizeSource(blueprint: ExamBlueprint | null): MockSizeSource {
  if (!blueprint) {
    return UNSTATED_SIZE;
  }

  const { edition, structure } = readBlueprintContent(blueprint);

  return getMockSizeSource({
    noticeQuestions: edition.questionCount,
    ownerId: blueprint.ownerId,
    structure,
  });
}
