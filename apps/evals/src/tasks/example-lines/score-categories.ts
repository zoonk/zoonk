import { defineScoreCategories } from "@/lib/score-categories";

export const EXAMPLE_LINES_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Audit the fit. A line shows the screen's idea in a familiar part of the learner's life outside the lesson's own subject (their work when the lesson isn't about it, a hobby or sport they follow, their routine or home), so they see the idea from a new side. When the learner's facts or goal fit a screen's idea naturally, its line uses them concretely, and it only uses what the facts and goal say, inventing nothing about the learner. A line that only says the screen's point again, or moves the screen's own case into the learner's work when the lesson teaches that work's field ("In the app you maintain at work, await…"), scores at most 4, even when it's correct. When nothing fits a screen, its line is null; a forced or generic line then scores at most 6, and so does a line that tells the same moment (place, job, purchase or scene) as another line or as EARLIER_LINES. Returning null when a fact clearly fits and no other line used it scores at most 7.`,
    id: "fit",
    label: "Uses what fits, never the same moment twice",
    readerExpectations: `Check the fit. When the learner's facts or goal fit a screen's idea naturally, its line uses them concretely (their work, city or routine), and it only uses what the facts and goal say, inventing nothing about the learner. When nothing fits a screen, its line is null. Notice a forced or generic line, a line that tells the same moment (place, job, purchase or scene) as another line or as EARLIER_LINES, and a null line where a fact clearly fits and no other line used it: the learner gets a line that isn't about them, the same scene twice, or misses the one that was.`,
    weight: 40,
  },
  {
    expectations: `Audit correctness: each line's moment works exactly the way its own screen explains the idea, part for part, claiming nothing the screen doesn't, and every number in it is right. Score at most 6 for any error.`,
    id: "accuracy",
    label: "Correct",
    readerExpectations: `Check correctness: each line applies its own screen's idea exactly as that screen explains it, and every number in it is right. Any error teaches the learner the idea wrong, in their own life.`,
    weight: 35,
  },
  {
    expectations: `Audit the writing: each line is one sentence of about 200 characters or less, addressed to "you", in the requested language variant, not starting with "For example", no question, praise or promise, and no guesses about age, gender, health, beliefs or money situation. Score at most 7 for any slip.`,
    id: "writing",
    label: "One natural sentence each",
    readerExpectations: `Check the writing: each line is one sentence of about 200 characters or less, addressed to "you", in the requested language variant, not starting with "For example", no question, praise or promise, and no guesses about age, gender, health, beliefs or money situation. A slip here costs less than a wrong idea, except a guess about the person, which can hurt.`,
    weight: 25,
  },
]);
