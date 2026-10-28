import { type MockTypedPart, listMockLeftOut } from "../exams/mocks/mock-left-out";
import { type MockPlan, countPlannedQuestions } from "../exams/mocks/mock-plan";
import { type MockLeftOut } from "../exams/mocks/mock-view-contract";
import { type MockDayWrittenPart } from "../exams/mocks/written-parts";
import { type ExamStructure } from "../library/exams/blueprint-contract";

export const EXAM_DAY_CHECKLIST = [
  "waterAndSnack",
  "phoneOnSilent",
  "clearDesk",
  "clockInView",
] as const;

export type ExamDayChecklistItem = (typeof EXAM_DAY_CHECKLIST)[number];

export type MockConditions = {
  /** False means half an exam day; true means the whole day. */
  fullLength: boolean;
  leftOut: MockLeftOut[];
  netScoring: boolean;
  questions: number;
  sections: {
    minutes: number | null;
    name: string | null;
    questions: number | null;
    tools: string | null;
  }[];
  timeLimitMinutes: number;
  /** Written tasks are included only in full-length mocks. */
  written: MockDayWrittenPart[];
};

export function toMockConditions({
  plan,
  structure,
  typed,
}: {
  plan: MockPlan;
  structure: ExamStructure | null;
  typed: readonly MockTypedPart[];
}): MockConditions {
  return {
    fullLength: plan.fullLength,
    leftOut: listMockLeftOut({
      asked: plan.written.filter((part) => part.asked).map((part) => part.name),
      day: plan.day,
      kind: plan.fullLength ? "full" : "half",
      structure,
      typed,
    }),
    netScoring: isNetScored(structure),
    questions: countPlannedQuestions(plan),
    sections: plan.sections.flatMap(({ minutes, name, questions, tools }) =>
      questions > 0 ? [{ minutes, name, questions, tools: tools ?? null }] : [],
    ),
    timeLimitMinutes: plan.minutes,
    written: plan.written,
  };
}

export function isNetScored(structure: Partial<Pick<ExamStructure, "mock">> | null): boolean {
  return structure?.mock?.scoring.method === "wrongCancelsRight";
}
