import { defineScoreCategories } from "@/lib/score-categories";

export const ALPHABET_LESSON_FIX_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Each rewritten card fixes the problem named for its screen: its sound cue now matches the letter's real sound in the target language, compares it with a word that has that sound in the learner's standard accent or says what differs, and agrees with its romanization and the audio it plays. Score at most 4 when a cue is still wrong or the rewrite adds a new error.`,
    id: "fixed",
    label: "Problem fixed right",
    weight: 70,
  },
  {
    expectations: `The rewritten cue is one short line in the learner's language and its variant, plain and warm, and shows the syllable the audio plays with its romanization. Score at most 5 for text in the wrong language.`,
    id: "language",
    label: "Learner's language and style",
    weight: 30,
  },
]);
