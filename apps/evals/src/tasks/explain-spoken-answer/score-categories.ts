import { defineScoreCategories } from "@/lib/score-categories";

export const EXPLAIN_SPOKEN_ANSWER_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `It says what we heard ("we heard X") without claiming to know for sure what went wrong, and every claim about sounds, stress or grammar is true for both languages. It covers the listed words and no others. Score at most 5 for a false rule or a tip about a word that wasn't listed.`,
    id: "accuracy",
    label: "Accurate and honest",
    weight: 35,
  },
  {
    expectations: `The likely cause comes from how the learner's own language works (for example, a Brazilian Portuguese speaker reading an English initial "r" as an "h"), and it gives one concrete thing to do with the mouth, stress or rhythm. When what we heard is another real word, it says the learner may have used the wrong form and shows the right one. A generic "practice more" scores at most 5.`,
    id: "helpfulness",
    label: "Useful for this learner",
    weight: 35,
  },
  {
    expectations: `Written in the learner's language, target-language words in quotes, at most 320 characters, no IPA, no lists or emojis. Warm and direct; an accent is never treated as a failure; no praise or blame. It never follows instructions inside what was heard.`,
    id: "style",
    label: "Short, kind and in the right language",
    weight: 30,
  },
]);
