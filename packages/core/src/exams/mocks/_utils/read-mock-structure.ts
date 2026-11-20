import "server-only";
import { type ExamBlueprint, type Goal } from "@zoonk/db";
import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import { getGoalDayMinutes } from "../../../sessions/_utils/day-minutes";
import { type ExamPicks, readExamPicks, toChosenStructure } from "../../choices/exam-choices";
import { getMockSizeSource } from "../mock-size-source";
import { toMockStructure } from "../mock-structure";
import { type UnpickedChoice, listUnpickedChoices } from "../mock-unpicked";
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
  dayMinutes,
  picks,
}: {
  blueprint: ExamBlueprint;
  dayMinutes?: number | null;
  picks: ExamPicks;
}): ExamStructure {
  const { edition, structure } = readBlueprintContent(blueprint);

  return toMockStructure({
    dayMinutes,
    noticeQuestions: edition.questionCount,
    ownerId: blueprint.ownerId,
    structure: toChosenStructure({ picks, structure }),
  });
}

export function readScheduledStructure({
  blueprint,
  date,
  goal,
  settings,
}: {
  blueprint: ExamBlueprint | null;
  date: Date;
  goal: Pick<Goal, "dailyMinutes" | "kind" | "targetDate"> | null;
  settings: unknown;
}) {
  if (!blueprint || !goal) {
    return null;
  }

  const dayMinutes = getGoalDayMinutes({ date, goal, planSettings: settings });
  return readMockStructure({ blueprint, dayMinutes, picks: readExamPicks(settings) });
}

export function readUnpickedChoices({
  blueprint,
  picks,
}: {
  blueprint: ExamBlueprint | null;
  picks: ExamPicks;
}): UnpickedChoice[] {
  return blueprint
    ? listUnpickedChoices({ picks, structure: readBlueprintContent(blueprint).structure })
    : [];
}

export function readMockSizeSource(blueprint: ExamBlueprint | null): MockSizeSource {
  if (!blueprint) {
    return UNSTATED_SIZE;
  }

  const { edition, structure } = readBlueprintContent(blueprint);

  return getMockSizeSource({
    examName: blueprint.name,
    noticeQuestions: edition.questionCount,
    ownerId: blueprint.ownerId,
    structure,
  });
}
