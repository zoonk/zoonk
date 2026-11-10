import { type SupportedLocale } from "@zoonk/utils/locale";
import { trackOnboardingProgress } from "../../../analytics/track-onboarding-progress";
import { answerProfileQuestion } from "../../../profile/questions/answer-profile-question";
import {
  PROFILE_QUESTIONS,
  profileAnswerInputSchema,
} from "../../../profile/questions/profile-question-contract";
import { skipProfileQuestions } from "../../../profile/questions/skip-profile-questions";
import { type OnboardingAnswerResult } from "../answer-onboarding-question";
import { type OnboardingAnswerInput } from "../onboarding-contract";

type ProfileOnboardingInput = Extract<
  OnboardingAnswerInput,
  { answer: unknown } | { question: "skipProfile" }
>;

export async function answerProfileOnboardingQuestion({
  goalId,
  input,
  locale,
}: {
  goalId: string;
  input: ProfileOnboardingInput;
  locale: SupportedLocale;
}): Promise<OnboardingAnswerResult> {
  if (input.question === "skipProfile") {
    const result = await skipProfileQuestions({
      forever: input.forever,
      goalId,
      locale,
      questions: [...PROFILE_QUESTIONS],
    });

    return result.status === "saved" ? { movedTo: null, status: "saved" } : result;
  }

  const result =
    input.answer === null
      ? await skipProfileQuestions({ goalId, locale, questions: [input.question] })
      : await answerProfileQuestion({
          input: profileAnswerInputSchema.parse(input),
          locale,
          onboardingGoalId: goalId,
        });

  if (result.status === "saved" && "changed" in result && result.changed) {
    trackOnboardingProgress({
      at: Date.now(),
      goalId,
      question: input.question,
      stage: "question_answered",
    });
  }

  return result.status === "saved" ? { movedTo: null, status: "saved" } : result;
}
