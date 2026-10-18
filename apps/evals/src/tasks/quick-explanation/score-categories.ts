import { defineScoreCategories } from "@/lib/score-categories";

export const QUICK_EXPLANATION_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Every statement must be correct. Simplifications are fine only when they stay true ("roughly", "in most cases"); a simplification that becomes false scores at most 6. When the honest answer is "it depends", the explanation says so and on what. Health, law and money topics must not give a diagnosis, legal advice or an investment recommendation.`,
    id: "accuracy",
    label: "Accuracy",
    weight: 25,
  },
  {
    expectations: `4 to 6 short screens, each teaching exactly one idea that builds on the previous one, so the last screen completes the answer. The first screen hooks with something familiar instead of announcing the topic. The whole story fits about five minutes of reading. Score at most 7 when a screen packs two or more new ideas, when screens repeat each other, or when the story ends before answering the question.`,
    id: "clarity",
    label: "Clarity & one idea per screen",
    weight: 20,
  },
  {
    expectations: `Plain everyday words a curious 12-year-old can follow. A technical term appears only after the plain idea it names. No formulas, equations, symbols or code unless the question asks for them; when it asks for a formula, the formula is explained in words. Score at most 6 when a formula appears without being asked for, and at most 7 when two or more terms are used before they are explained.`,
    id: "everydayWords",
    label: "Everyday words, no formulas unless asked",
    weight: 20,
  },
  {
    expectations: `At least one screen shows a concrete practical example or use the reader meets in real life, and most screens give something concrete (an everyday comparison or example). Score at most 7 when the examples are generic or when comparisons would mislead.`,
    id: "practicalExample",
    label: "Practical example",
    weight: 15,
  },
  {
    expectations: `The single check makes the reader use the main idea in a new situation rather than repeat a sentence, has one clearly correct option, options similar in length and tone, and feedback that says why each option is right or wrong.`,
    id: "check",
    label: "The check",
    weight: 10,
  },
  {
    expectations: `The "Now you know" recap has 3 short bullets that match what the story taught, in order. "Want to go further?" names a sensible broad beginner course for the question and 2 or 3 natural follow-up questions. The title is short, neutral and recognizable by anyone asking the same thing.`,
    id: "ending",
    label: "Recap, go further and title",
    weight: 10,
  },
]);
