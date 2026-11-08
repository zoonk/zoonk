type OnboardingStage =
  | "attempt_linked"
  | "goal_created"
  | "question_shown"
  | "question_answered"
  | "run_step"
  | "deck_claimed"
  | "deck_saved"
  | "deck_received"
  | "first_scene_visible"
  | "first_answer";

export type OnboardingProgress = {
  at: number;
  goal_id: string | null;
  stage: OnboardingStage;
  attempt_id?: string;
  onboarding_id?: string;
  question?: string;
  step?: string;
  status?: string;
  deck_id?: string;
  lesson_id?: string;
  cache?: "cold" | "warm";
};
