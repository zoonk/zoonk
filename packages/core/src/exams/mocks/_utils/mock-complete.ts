import { type MockPlan, countPlannedQuestions } from "../mock-plan";
import { type MockListening } from "./mock-listening";

export function isPaperComplete(
  plan: MockPlan,
  questions: number,
  written: number,
  missingRecordings = 0,
) {
  return (
    plan.sections.length > 0 &&
    countPlannedQuestions(plan) === questions &&
    plan.sections.reduce((sum, section) => sum + section.essays.length, 0) === written &&
    missingRecordings === 0
  );
}

export function isScheduledPaperComplete(
  plan: MockPlan & { outline: MockPlan; audio: MockListening },
) {
  return isPaperComplete(
    plan,
    countPlannedQuestions(plan.outline),
    plan.outline.sections.reduce((sum, section) => sum + section.essays.length, 0),
    plan.outline.sections.filter((section) => section.name && plan.audio.unvoiced.has(section.name))
      .length,
  );
}
