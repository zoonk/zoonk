import { type MockPlan, countPlannedQuestions } from "../mock-plan";
import { type MockListening } from "./mock-listening";

/** `writing`: the learner has an unseen prompt for each written question the paper sits. */
export function isPaperComplete({
  missingRecordings = 0,
  plan,
  questions,
  writing,
}: {
  missingRecordings?: number;
  plan: MockPlan;
  questions: number;
  writing: boolean;
}) {
  return (
    plan.sections.length > 0 &&
    countPlannedQuestions(plan) === questions &&
    missingRecordings === 0 &&
    writing
  );
}

export function isScheduledPaperComplete(
  plan: MockPlan & { outline: MockPlan; audio: MockListening },
  writing: boolean,
) {
  return isPaperComplete({
    missingRecordings: plan.outline.sections.filter(
      (section) => section.name && plan.audio.unvoiced.has(section.name),
    ).length,
    plan,
    questions: countPlannedQuestions(plan.outline),
    writing,
  });
}
