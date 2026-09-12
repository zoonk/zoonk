export type LearningContext = {
  format: "core" | "language" | "question" | "personalized";
  level: string | null;
  outcomes: string[];
  privateBrief?: unknown;
};

/** Only private lessons may receive personal requirements or learner context. */
export function formatLearningContext(context?: LearningContext): string {
  if (!context) {
    return "Use the lesson's stated scope and introduce ideas in plain language.";
  }

  if (context.format !== "personalized" && context.privateBrief) {
    throw new Error("Private learner context cannot shape a reusable lesson");
  }

  return JSON.stringify(context);
}
