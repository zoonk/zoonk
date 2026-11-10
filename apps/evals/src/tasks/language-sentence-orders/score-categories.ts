import { defineScoreCategories } from "@/lib/score-categories";

export const SENTENCE_ORDERS_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Every kept order is one a native teacher would accept as a correct answer: grammatical, said in everyday speech, and with the same meaning as the lesson's own order (the same doer and object, each word in the same clause, the same scope of a negation or "only", still a question when it was one). A fronted or topicalized phrase native speakers really say is fine. A single kept order that is ungrammatical, that native speakers don't say, or that changes the meaning is a serious error: score at most 5, since the app would mark a learner's wrong sentence right.`,
    id: "precision",
    label: "Only correct orders",
    weight: 70,
  },
  {
    expectations: `The common, natural other orders are kept, such as a time phrase moved to the other end or a clause before or after the main one where both are everyday speech. A missing order lowers the score less than a wrong one; an empty list is right when the order is fixed.`,
    id: "recall",
    label: "Common orders found",
    weight: 30,
  },
]);
