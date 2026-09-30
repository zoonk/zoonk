import { getModelFamily } from "../../../_utils/model-family";

/**
 * Reviewers in order of preference, from the lesson-quality-check eval (11
 * lessons with planted mistakes or none, 26 Sep 2026): Opus 5.5 blocked every
 * planted mistake and passed both clean lessons at $49 per 1,000 checks;
 * Gemini 3.8 Flash missed a reason that contradicts its option, at $8. Catching
 * real errors matters most on the lessons that get this check, so Opus leads.
 */
const REVIEWER_MODELS = [
  "anthropic/claude-opus-5.5",
  "google/gemini-3.8-flash",
  "openai/gpt-6-sol",
] as const;

/**
 * Picks the reviewer and its fallbacks from families other than the writer's,
 * because a model tends to miss its own family's mistakes. It reads the model
 * that actually wrote the lesson, so a writer fallback changes the reviewer too.
 */
export function getLessonCheckModels(writerModel: string): {
  fallbackModels: string[];
  model: string;
} {
  const writerFamily = getModelFamily(writerModel);

  const [model = REVIEWER_MODELS[0], ...fallbackModels] = REVIEWER_MODELS.filter(
    (candidate) => getModelFamily(candidate) !== writerFamily,
  );

  return { fallbackModels, model };
}
