import { defineScoreCategories } from "@/lib/score-categories";

export const QUICK_EXPLANATION_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Every statement must be correct. Simplifications are fine only when they stay true ("roughly", "in most cases"); one that becomes false teaches the reader something wrong. When the honest answer is "it depends", the explanation says so and on what. Health, law and money topics must not give a diagnosis, legal advice or an investment recommendation.`,
    id: "accuracy",
    label: "Accuracy",
    weight: 25,
  },
  {
    expectations: `4 to 6 short screens, each teaching exactly one idea that builds on the previous one, so the last screen completes the answer. The first screen hooks with something familiar instead of announcing the topic. The whole story fits about five minutes of reading. Notice a screen that packs two or more new ideas, screens that repeat each other, and a story that ends before answering the question.`,
    id: "clarity",
    label: "Clarity & one idea per screen",
    weight: 20,
  },
  {
    expectations: `Plain everyday words a curious 12-year-old can follow. A technical term appears only after the plain idea it names. No formulas, equations, symbols or code unless the question asks for them; when it asks for a formula, the formula is explained in words. A formula the reader didn't ask for, or terms used before they're explained, lose the reader this explanation is for.`,
    id: "everydayWords",
    label: "Everyday words, no formulas unless asked",
    weight: 20,
  },
  {
    expectations: `At least one screen shows a concrete practical example or use the reader meets in real life, and most screens give something concrete (an everyday comparison or example). Generic examples leave the reader nothing to picture, and a misleading comparison gives them the wrong picture.`,
    id: "practicalExample",
    label: "Practical example",
    weight: 15,
  },
  {
    expectations: `The single check makes the reader use the main idea in a new situation rather than repeat a sentence, has one clearly correct option, options similar in length and tone, and feedback that says why each option is right or wrong. A right option that restates the situation the question describes in other words lets the reader pick it by matching words, without using the idea.`,
    id: "check",
    label: "The check",
    weight: 10,
  },
  {
    expectations: `The "Now you know" recap has 3 short bullets that match what the story taught, in order. "Want to go further?" names a sensible broad beginner course for the question and 2 or 3 natural follow-up questions. The title is short, neutral and recognizable by anyone asking the same thing, and the description is one plain sentence saying what the explanation answers, not a screen's title or the question's personal wording. Every picture's alt text says in one sentence what that picture shows, for someone who can't see it; an alt that only repeats its screen's title tells them nothing.`,
    id: "ending",
    label: "Recap, go further, title, description and alt text",
    weight: 10,
  },
]);
