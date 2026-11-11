import { detectLanguageExam } from "../../../exams/language-exam";
import { getReasonAim } from "../../../language/aims/language-aims";
import { type OnboardingAnswerInput } from "../onboarding-contract";

/**
 * A certificate its exam goal can plan carries no aim of its own; one we can't plan for aims as
 * Something else does.
 */
export function getReasonDetails({
  reason,
  words,
}: Extract<OnboardingAnswerInput, { question: "reason" }>): Record<string, unknown> {
  const exam = reason === "certificate" && words ? detectLanguageExam(words) : null;
  const aim = exam ? null : (getReasonAim(reason) ?? getReasonAim("other"));

  return { reason: words ?? reason, ...(aim && { targetScore: aim }) };
}
