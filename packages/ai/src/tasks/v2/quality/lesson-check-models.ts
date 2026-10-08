import { getModelFamily } from "../../../_utils/model-family";
import { type CallReuse } from "../../../provider-options";

/**
 * Reviewers for lessons very likely read again (an exam's, a language's, a popular shared
 * course's), in order of preference, from the lesson-quality-check eval (20 lessons with planted
 * mistakes or none): Sonnet 5.5 (7 Oct 2026) blocked all 14 planted mistakes and passed 5 of 6
 * clean lessons, as Opus 5.5 did, at $29 per 1,000 checks against Opus's $50 (p50 17 s against
 * 13 s); with the prompt's check of every reason it blocked 13 (it called a check's absurd wrong
 * options minor) at $27. Sonnet 5 caught 11 of 13. Catching every real error matters most on a
 * lesson many learners read, so Sonnet 5.5 leads. Claude Haiku 5.5 caught 12 of 14 and passed 2
 * of 6 clean ones, and 14 and 3 at high effort (p50 35 s, $4): blocking clean lessons sends them
 * to a fix pass, so it isn't cheaper in the end.
 */
const REUSED_LESSON_REVIEWERS = [
  "anthropic/claude-sonnet-5.5",
  "google/gemini-3.8-flash",
  "openai/gpt-6-sol",
] as const;

/**
 * Reviewers for lessons that may serve one learner only (a niche goal's shared lesson, a private
 * course's): Gemini 3.8 Flash passed every clean lesson and caught 13 of 14 planted mistakes at
 * $8 per 1,000 checks (p50 6.5 s), missing a wrong option's reason whose mistake doesn't lead to
 * it. Once the prompt asked to redo every reason's steps (7 Oct 2026) it caught all 14 and passed
 * 5 of 6 clean lessons at $11 (p50 13 s), about 40% of Sonnet's price: in one clean lesson it
 * reads "you took the start away" (7 − (−4) = 11) as 7 − 4, in 3 of 4 runs, which costs a fix
 * pass on that screen. A lesson Gemini wrote gets the next reviewer from another family.
 */
const ONE_LEARNER_LESSON_REVIEWERS = [
  "google/gemini-3.8-flash",
  "anthropic/claude-sonnet-5.5",
  "openai/gpt-6-sol",
] as const;

/**
 * The single rule for a lesson's reviewer: how likely the lesson is to be read again (`CallReuse`,
 * the same signal its service tier follows) picks the list, `bounded` the strongest reviewer and
 * the rest the cheaper one, and the reviewer and its fallbacks come from families other than the
 * writer's, because a model tends to miss its own family's mistakes. It reads the model that
 * actually wrote the lesson, so a writer fallback changes the reviewer too.
 */
export function getLessonCheckModels({
  reuse,
  writerModel,
}: {
  reuse: CallReuse;
  writerModel: string;
}): { fallbackModels: string[]; model: string } {
  const writerFamily = getModelFamily(writerModel);
  const reviewers = reuse === "bounded" ? REUSED_LESSON_REVIEWERS : ONE_LEARNER_LESSON_REVIEWERS;

  const [model = reviewers[0], ...fallbackModels] = reviewers.filter(
    (candidate) => getModelFamily(candidate) !== writerFamily,
  );

  return { fallbackModels, model };
}
