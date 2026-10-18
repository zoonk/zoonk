import { defineScoreCategories } from "@/lib/score-categories";

export const EXAMPLE_LINES_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Audit the fit. When the learner's facts or goal fit a screen's idea naturally, its line uses them concretely (their work, city or routine), and it only uses what the facts and goal say, inventing nothing about the learner. When nothing fits a screen, its line is null; a forced or generic line then scores at most 6, and so does a line that tells the same moment (place, job, purchase or scene) as another line or as EARLIER_LINES. Returning null when a fact clearly fits and no other line used it scores at most 7.`,
    id: "fit",
    label: "Uses what fits, never the same moment twice",
    weight: 40,
  },
  {
    expectations: `Audit correctness: each line applies its own screen's idea exactly as that screen explains it, and every number in it is right. Score at most 6 for any error.`,
    id: "accuracy",
    label: "Correct",
    weight: 35,
  },
  {
    expectations: `Audit the writing: each line is one sentence of about 200 characters or less, addressed to "you", in the requested language variant, not starting with "For example", no question, praise or promise, and no guesses about age, gender, health, beliefs or money situation. Score at most 7 for any slip.`,
    id: "writing",
    label: "One natural sentence each",
    weight: 25,
  },
]);
