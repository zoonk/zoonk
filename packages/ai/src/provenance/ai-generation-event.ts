export type AiGenerationContext = {
  /** Omit it for system work no learner triggered. */
  distinctId?: string;
  goalId?: string;
  /** Defaults to shared. */
  contentScope?: "personal" | "shared";
  traceId?: string;
};
