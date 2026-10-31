import { defineScoreCategories } from "@/lib/score-categories";

export const ALPHABET_LESSON_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Every letter is a real letter of the script, its romanization follows the standard system, its sound cue is right for the learner's language (Japanese vowels short and pure, Korean plain stops unaspirated, Russian false friends named), audioText is what a voice should say for it, and forms are only real positional forms (Arabic), never invented. Score at most 4 for a wrong sound, a wrong romanization or an invented form.`,
    id: "accuracy",
    label: "Accurate letters and sounds",
    weight: 45,
  },
  {
    expectations: `A good first lesson: the smallest useful set to read something real in the order a teacher presents it (hiragana vowels and K, Hangul basics that build blocks, Cyrillic look-alikes that sound different, Arabic letters with their joining), an intro with the one practical idea needed to read them (not history), a clear can-do and a short summary. Score at most 6 for dumping many letters or an intro that doesn't help read them.`,
    id: "pedagogy",
    label: "Right first letters, useful intro",
    weight: 35,
  },
  {
    expectations: `Everything the learner reads is in their language and its variant (US English, Brazilian Portuguese), except the script and romanization; characters in the intro carry their romanization in parentheses. Plain, warm and concrete, no meta lines. Score at most 5 for text in the wrong language.`,
    id: "language",
    label: "Learner's language and tone",
    weight: 20,
  },
]);
