import {
  type MockPlan,
  type MockWrittenPart,
  countPlannedQuestions,
} from "../exams/mocks/mock-plan";
import { type ExamStructure } from "../library/exams/blueprint-contract";

/**
 * The weekly checkpoint, the Big Challenge. For an exam it's a mock in the real exam's
 * conditions (questions, sections, time and scoring from the blueprint) with this checklist to
 * rehearse the day: fixed keys the apps translate, checked off on the device. For other goals it's
 * a mixed challenge on the week's skills, asked like a phase checkpoint.
 */
export const EXAM_DAY_CHECKLIST = [
  "waterAndSnack",
  "phoneOnSilent",
  "clearDesk",
  "clockInView",
] as const;

export type ExamDayChecklistItem = (typeof EXAM_DAY_CHECKLIST)[number];

export type MockConditions = {
  /**
   * The whole exam day, as in the final stretch; otherwise a short mock, half of it, which is
   * what regular weeks hold.
   */
  fullLength: boolean;
  /** Wrong answers cancel right ones, as in Cebraspe exams: scored as a net score. */
  netScoring: boolean;
  questions: number;
  sections: { minutes: number | null; name: string | null; questions: number | null }[];
  timeLimitMinutes: number;
  /** A full-length mock's written parts, as the notice states them (see `MockWrittenPart`). */
  written: MockWrittenPart[];
};

/**
 * What the card before a mock says about it: its questions, sections and time from the planned
 * mock (one exam day at the real pace), and whether wrong answers cancel right ones.
 */
export function toMockConditions({
  plan,
  structure,
}: {
  plan: MockPlan;
  structure: ExamStructure | null;
}): MockConditions {
  return {
    fullLength: plan.fullLength,
    netScoring: isNetScored(structure),
    questions: countPlannedQuestions(plan),
    sections: plan.sections.map(({ minutes, name, questions }) => ({ minutes, name, questions })),
    timeLimitMinutes: plan.minutes,
    written: plan.written,
  };
}

/** Whether the exam's own scoring cancels right answers with wrong ones. */
export function isNetScored(structure: Partial<Pick<ExamStructure, "mock">> | null): boolean {
  return structure?.mock?.scoring.method === "wrongCancelsRight";
}
