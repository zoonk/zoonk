import { defineScoreCategories } from "@/lib/score-categories";

export const STATUTE_DRILLS_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Judge every drill only against the article texts given in the input, not against memory of the law. A true statement must say only what its article says (an incomplete statement is still true, as boards rule, unless it claims there are no exceptions); a false statement must really contradict its article; a fill-in-the-blank passage must be the article's text with the right words missing; a multiple-choice question must have exactly one option that matches the text. Every reason must quote the article correctly and cite the right reference. A wrong key or a misquoted law teaches the learner the law wrong.`,
    id: "legalAccuracy",
    label: "Legal accuracy",
    weight: 35,
  },
  {
    expectations: `Every false statement and wrong option must change exactly one element of its article, the way Cebraspe and FGV do: a quantifier ("todos" to "quase todos"), permission and prohibition, a number or deadline, the authority that acts, an exception or condition, or a legal consequence, keeping the rest of the wording so only a careful reader notices. Its misconception must name that trap in a few words. Fill-in-the-blank gaps must remove a load-bearing word or number, never a word guessable from grammar. Traps that change two things at once or are absurd or vague, generic misconceptions ("wrong statement"), and gaps that remove filler words give the learner practice unlike the real board's.`,
    id: "boardTraps",
    label: "Board-style traps",
    weight: 30,
  },
  {
    expectations: `The set must follow the requested style: Cebraspe as right/wrong statements with about half false, FGV as 4-option multiple choice asking what the literal text says, and generic as a mix of true/false, fill-in-the-blank and multiple choice. Statements, passages and options must keep the law's own language and wording; reasons and misconceptions must be in the learner's language, speak to the learner and say what changed. A set that would look out of place in the named board's exam, or that mixes up languages, prepares the learner for the wrong test.`,
    id: "styleAndLanguage",
    label: "Style & language",
    weight: 20,
  },
  {
    expectations: `The drills should spread across the given articles and difficulty levels, and no two drills should test the same element the same way. Drills that mostly cover one article or repeat one trap leave the rest unpracticed.`,
    id: "coverage",
    label: "Coverage & variety",
    weight: 15,
  },
]);
