import "server-only";
import { type ExamBlueprint } from "@zoonk/db";
import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import { type ExamChoice, toChosenStructure } from "../../choices/exam-choices";
import { getMockSizeSource } from "../mock-size-source";
import { toMockStructure } from "../mock-structure";
import { type MockSizeSource } from "../mock-view-contract";

const UNSTATED_SIZE: MockSizeSource = {
  formats: null,
  material: false,
  pastEdition: null,
  questions: "unstated",
  subjects: null,
  time: "unstated",
};

export function readMockStructure({
  blueprint,
  choices,
  dayMinutes,
}: {
  blueprint: ExamBlueprint;
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
