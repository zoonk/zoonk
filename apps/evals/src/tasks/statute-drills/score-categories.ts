import { defineScoreCategories } from "@/lib/score-categories";

export const STATUTE_DRILLS_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Judge every drill only against the article texts given in the input, not against memory of the law. A true statement must say only what its article says (an incomplete statement is still true, as boards rule, unless it claims there are no exceptions); a false statement must really contradict its article; a fill-in-the-blank passage must be the article's text with the right words missing; a multiple-choice question must have exactly one option that matches the text. Every reason must quote the article correctly and cite the right reference. Score at most 7 when one drill has a wrong key or misquotes the law; at most 5 when two or more do.`,
    id: "legalAccuracy",
    label: "Legal accuracy",
    weight: 35,
  },
  {
    expectations: `Every false statement and wrong option must change exactly one element of its article, the way Cebraspe and FGV do: a quantifier ("todos" to "quase todos"), permission and prohibition, a number or deadline, the authority that acts, an exception or condition, or a legal consequence, keeping the rest of the wording so only a careful reader notices. Its misconception must name that trap in a few words. Fill-in-the-blank gaps must remove a load-bearing word or number, never a word guessable from grammar. Score at most 7 when several traps change two things at once, are absurd or only vague, or when misconceptions are generic ("wrong statement"); at most 6 when most gaps remove filler words.`,
    id: "boardTraps",
    label: "Board-style traps",
    weight: 30,
  },
  {
    expectations: `The set must follow the requested style: Cebraspe as right/wrong statements with about half false, FGV as 4-option multiple choice asking what the literal text says, and generic as a mix of true/false, fill-in-the-blank and multiple choice. Statements, passages and options must keep the law's own language and wording; reasons and misconceptions must be in the learner's language, speak to the learner and say what changed. Score at most 7 when the set would look out of place in the named board's exam or mixes up languages.`,
    id: "styleAndLanguage",
    label: "Style & language",
    weight: 20,
  },
  {
    expectations: `The drills should spread across the given articles and difficulty levels, and no two drills should test the same element the same way. Score at most 7 when most drills cover one article or repeat one trap.`,
    id: "coverage",
    label: "Coverage & variety",
    weight: 15,
  },
]);
