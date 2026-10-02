import { defineScoreCategories } from "@/lib/score-categories";

export const LEVEL_TEST_BANK_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Each passage, question and speaking sentence sits clearly at its CEFR level, and the levels clearly increase: A1 asks for one stated fact in very common words, A2 simple stated facts, B1 the main point, a reason or a stated opinion (not a detail found by matching a word), B2 attitude, purpose or something implied in denser text, C1 tone and implication in nuanced text. Speaking sentences grow from about 5 simple words at A1 to about 20 with complex structures at C1. Score at most 5 when two neighboring levels are indistinguishable or a question is clearly at the wrong level.`,
    id: "calibration",
    label: "Levels calibrated and increasing",
    weight: 40,
  },
  {
    expectations: `Every question has exactly one clearly right option that the passage supports (check the passage for each option); wrong options are plausible to a careless reader but clearly wrong; no option can be picked from general knowledge alone; options are similar in length. Answer indexes point at the right option. Score at most 4 when a question has two defensible answers or none, or the marked answer is wrong.`,
    id: "answers",
    label: "One clearly right answer",
    weight: 35,
  },
  {
    expectations: `Passages and speaking sentences are natural and correct in the target variant (US English, Brazilian Portuguese, Spain Spanish). Reading passages read like real written texts and listening passages like natural speech (voicemail, announcement, audio message). Questions, options and translations are in the learner's language and its variant. Situations vary across the bank; no brands, real people or stereotypes. Score at most 5 for a field in the wrong language.`,
    id: "language",
    label: "Languages and variety",
    weight: 25,
  },
]);
