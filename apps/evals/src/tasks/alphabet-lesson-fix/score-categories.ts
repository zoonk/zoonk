import { defineScoreCategories } from "@/lib/score-categories";

export const ALPHABET_LESSON_FIX_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Each problem is fixed where it's named. A letter card's sound cue matches the letter's real sound in the target language, compares it with a word that has that sound in the learner's standard accent or says what differs, and agrees with its romanization and the audio it plays. An intro screen, or the lesson's title, description, can-do line or summary, now says what's right. A problem still there, or a fix that adds a new error, leaves the learner with the mistake the fix was for.`,
    id: "fixed",
    label: "Problem fixed right",
    weight: 70,
  },
  {
    expectations: `The rewritten text is in the learner's language and its variant, plain and warm, and a cue shows the syllable the audio plays with its romanization. Text in the wrong language is text the learner can't read.`,
    id: "language",
    label: "Learner's language and style",
    weight: 30,
  },
]);
