import { type OnboardingStep } from "./onboarding-contract";

/**
 * Questions whose answer can add another after them: a work or career-change purpose asks the role,
 * and a language reason that names a certificate asks the exam's questions.
 */
export const QUESTIONS_THAT_ADD_QUESTIONS: readonly OnboardingStep[] = ["purpose", "reason"];
