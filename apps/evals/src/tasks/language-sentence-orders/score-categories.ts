import { defineScoreCategories } from "@/lib/score-categories";

export const SENTENCE_ORDERS_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Every listed order uses exactly the sentence's (or translation's) words and is one a native teacher would mark fully correct with the same meaning: the same doer and object, the same scope of a negation or "only", the same register, still a question when it was one. A single order that is wrong, odd or marked, or that changes the meaning, is a serious error: score at most 5, since the app would mark a learner's wrong sentence right.`,
    id: "precision",
    label: "Only correct orders",
    weight: 70,
  },
  {
    expectations: `The common, natural other orders are listed, such as a time phrase moved to the other end or a clause before or after the main one where both are everyday speech. A missing order lowers the score less than a wrong one; an empty list is right when the order is fixed.`,
    id: "recall",
    label: "Common orders found",
    weight: 30,
  },
]);
