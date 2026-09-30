import { defineScoreCategories } from "@/lib/score-categories";

export const LANGUAGE_LESSON_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Every target-language word and sentence is grammatical, natural and in the requested variant (US English, Brazilian Portuguese or Spain Spanish, including vocabulary like "piso" and "fianza" in Spain). Every translation has exactly the meaning of the original. Tips, notes and explanations say only true things about both languages. Score at most 5 for a wrong translation, an ungrammatical sentence or a false rule; at most 7 for the wrong variant.`,
    id: "accuracy",
    label: "Accuracy",
    weight: 30,
  },
  {
    expectations: `The lesson is written for speakers of the learner's language: pronunciation tips name the sound those speakers get wrong and how to fix it, notes catch real false friends, sentence explanations compare with how the learner would say it, and respellings use only letters those speakers read naturally, with syllables and the stressed one in capitals. For Brazilian readers a vowel before an English initial "r" ("a-RÉNT") is the intended convention, because an initial "r" reads as "h" in Portuguese. Generic tips that would fit any learner, invented problems, or IPA symbols lower the score. Null tips and notes are right when there is nothing real to say.`,
    id: "pairAwareness",
    label: "Written for this language pair",
    weight: 20,
  },
  {
    expectations: `Words and sentences serve the lesson's exact situation and can-do, at the CEFR level given: at A1 and A2 short everyday sentences, more at B1 and B2. Nothing from the known words list is taught again. Words are the ones a learner in that situation needs first, not a padded list of variants.`,
    id: "situationAndLevel",
    label: "Situation and level",
    weight: 20,
  },
  {
    expectations: `Wrong options are plausible for a learner yet clearly wrong where they're used, and never appear in the answer next to them. The tip names one real pattern the sentences use, and its examples and practice all test that pattern. Each practice blank has exactly one right answer. Writing answers are all correct and cover common right variants. Speaking prompts set up a real moment in the learner's language.`,
    id: "practiceDesign",
    label: "Practice design",
    weight: 20,
  },
  {
    expectations: `Text in the learner's language is natural, concise and correct in its variant. Target-language fields (words, sentences, templates, answers) contain no learner-language words; learner-language fields may quote target-language words in quotes or backticks when they talk about them, which is intended. Target sentences and their translations, which become word tiles, have no decorative final periods or exclamation marks, while questions keep their question marks; other fields use normal punctuation. Summary lines each state one thing the learner can now say.`,
    id: "style",
    label: "Language and style",
    weight: 10,
  },
]);
