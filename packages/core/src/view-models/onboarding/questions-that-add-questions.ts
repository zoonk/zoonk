import { type OnboardingStep } from "./onboarding-contract";

/** Questions whose answer can add another after them: a work or career-change purpose asks the role. */
export const QUESTIONS_THAT_ADD_QUESTIONS: readonly OnboardingStep[] = ["purpose"];
