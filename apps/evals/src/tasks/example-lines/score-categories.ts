import { defineScoreCategories } from "@/lib/score-categories";

export const EXAMPLE_LINES_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Check the fit. When the learner's facts or goal fit a screen's idea naturally, its line uses them concretely (their work, city or routine), and it only uses what the facts and goal say, inventing nothing about the learner. When nothing fits a screen, its line is null. Notice a forced or generic line, a line that tells the same moment (place, job, purchase or scene) as another line or as EARLIER_LINES, and a null line where a fact clearly fits and no other line used it: the learner gets a line that isn't about them, the same scene twice, or misses the one that was.`,
    id: "fit",
    label: "Uses what fits, never the same moment twice",
    weight: 40,
  },
  {
    expectations: `Check correctness: each line applies its own screen's idea exactly as that screen explains it, and every number in it is right. Any error teaches the learner the idea wrong, in their own life.`,
    id: "accuracy",
    label: "Correct",
    weight: 35,
  },
  {
    expectations: `Check the writing: each line is one sentence of about 200 characters or less, addressed to "you", in the requested language variant, not starting with "For example", no question, praise or promise, and no guesses about age, gender, health, beliefs or money situation. A slip here costs less than a wrong idea, except a guess about the person, which can hurt.`,
    id: "writing",
    label: "One natural sentence each",
    weight: 25,
  },
]);
