import { defineScoreCategories } from "@/lib/score-categories";

export const EXAMPLE_LINE_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Audit the fit. When the learner's facts or goal fit the idea naturally, the line uses them concretely (their work, city or routine), and it only uses what the facts and goal say, inventing nothing about the learner. When nothing fits, the right answer is null; a forced or generic line then scores at most 6. Returning null when a fact clearly fits scores at most 7.`,
    id: "fit",
    label: "Uses what fits, invents nothing",
    weight: 40,
  },
  {
    expectations: `Audit correctness: the line applies the idea exactly as the screen explains it, and every number in it is right. Score at most 6 for any error.`,
    id: "accuracy",
    label: "Correct",
    weight: 35,
  },
  {
    expectations: `Audit the writing: one sentence of about 200 characters or less, addressed to "you", in the requested language variant, not starting with "For example", no question, praise or promise, and no guesses about age, gender, health, beliefs or money situation. Score at most 7 for any slip.`,
    id: "writing",
    label: "One natural sentence",
    weight: 25,
  },
]);
