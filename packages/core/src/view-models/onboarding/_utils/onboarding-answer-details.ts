import { type Goal } from "@zoonk/db";
import { isCountryCode } from "@zoonk/utils/countries";
import { isCountryGoal } from "../../../goals/_utils/goal-content-country";
import { type OnboardingAnswerInput } from "../onboarding-contract";
import { getFollowUpQuestions, readExamTarget } from "../onboarding-steps";
import { getReasonDetails } from "./reason-answer";

/** Profile answers are saved on the learner before an answer reaches the goal. */
export type GoalAnswerInput = Exclude<
  OnboardingAnswerInput,
  { answer: unknown } | { question: "skipProfile" }
>;

type Details = Record<string, unknown>;

const LEVEL_ANSWER_KEYS = new Set(["knownSubjects", "level"]);
const REASON_ANSWER_KEYS = new Set(["reason", "targetScore"]);

export function withoutReplacedAnswer({
  details,
  input,
}: {
  details: Details;
  input: GoalAnswerInput;
}): Details {
  if (input.question === "reason") {
    return Object.fromEntries(
      Object.entries(details).filter(([key]) => !REASON_ANSWER_KEYS.has(key)),
    );
  }

  return input.question === "level"
    ? Object.fromEntries(Object.entries(details).filter(([key]) => !LEVEL_ANSWER_KEYS.has(key)))
    : details;
}

function compactAnswers(answers: Record<string, string | null | undefined>): Details {
  return Object.fromEntries(Object.entries(answers).filter(([, value]) => value));
}

function getTargetField(details: Details): "targetNote" | "targetPosition" | "targetScore" {
  switch (readExamTarget(details)) {
    case "position":
      return "targetPosition";
    case "score":
      return "targetScore";
    case "admission":
    case null:
      return "targetNote";
    default:
      return "targetNote";
  }
}

export function getDetailChanges({
  details,
  input,
}: {
  details: Details;
  input: GoalAnswerInput;
}): Details {
  switch (input.question) {
    case "contentCountry":
      return { contentCountrySource: input.country === null ? "default" : "picked" };
    case "purpose":
      return { purpose: input.purpose };
    case "role":
      return compactAnswers({
        role: input.role,
        targetPosition: input.targetPosition,
        tasks: input.tasks,
      });
    case "reason":
      return getReasonDetails(input);
    case "target":
      return input.target ? { [getTargetField(details)]: input.target } : {};
    case "followUps":
      return {
        followUps: getFollowUpQuestions(details).map((question, index) => ({
          answer: input.answers[index] ?? null,
          question,
        })),
      };
    case "level":
      return {
        ...(input.level ? { level: input.level } : {}),
        ...(input.knownSubjects?.length ? { knownSubjects: input.knownSubjects } : {}),
      };
    case "buddy":
    case "examChoice":
    case "placement":
    case "schedule":
    case "targetDate":
      return {};
    default:
      return {};
  }
}

export function isInvalidGoalAnswer({
  current,
  input,
}: {
  current: Goal;
  input: GoalAnswerInput;
}): boolean {
  if (input.question === "reason") {
    return current.kind !== "language";
  }

  return (
    input.question === "contentCountry" &&
    (!isCountryGoal(current) || (input.country !== null && !isCountryCode(input.country)))
  );
}

export function getCountryAnswerData(input: GoalAnswerInput) {
  return input.question === "contentCountry" ? { contentCountry: input.country } : {};
}
