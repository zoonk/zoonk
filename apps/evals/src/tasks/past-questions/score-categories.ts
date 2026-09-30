import { defineScoreCategories } from "@/lib/score-categories";

export const PAST_QUESTIONS_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Solve every question yourself. The keyed answer must match the answer key in the paper when it has one, and otherwise be the one defensible answer. Score at most 5 when any question has a wrong key.`,
    id: "keys",
    label: "Right answers",
    weight: 30,
  },
  {
    expectations: `The questions taken are the right ones: each tests the skill it's tagged with, and questions that need a figure, chart, map, table or image the text doesn't carry, questions cut off, annulled questions and questions on skills not listed are left out. Score at most 6 when a question that should have been left out is included; at most 8 when a question that fits a listed skill is missing without reason.`,
    id: "selection",
    label: "Which questions",
    weight: 25,
  },
  {
    expectations: `Every wrong option's reason tells the learner in plain words why it's wrong and names the mistake behind it, and its misconception is a short neutral label of that mistake; the right option's reason says why it's right; true or false statements explain the judgment and name the trap. Everything the model wrote (not the quoted parts) is in the requested language and speaks to the learner as "you". Score at most 7 when reasons only restate the answer or misconceptions are generic.`,
    id: "feedback",
    label: "Feedback on every option",
    weight: 25,
  },
  {
    expectations: `Each citation names the exam, the edition or year and the question's number as the paper gives them, in the requested language, and support texts keep the credit line of their author or source. Score at most 7 when a support text lost its credit line.`,
    id: "citation",
    label: "Citation and credit",
    weight: 20,
  },
]);
