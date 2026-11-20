import { defineScoreCategories } from "@/lib/score-categories";

export const PAST_QUESTIONS_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Solve every question yourself. The keyed answer must match the answer key in the paper when it has one, and otherwise be the one defensible answer. A wrong key marks the learner wrong for being right.`,
    id: "keys",
    label: "Right answers",
    weight: 30,
  },
  {
    expectations: `The questions taken are the right ones: each tests the skill it's tagged with, and questions that need a figure, chart, map, table or image the text doesn't carry, questions cut off, annulled questions and questions on skills not listed are left out. A question that should have been left out shows the learner something they can't answer; a question that fits a listed skill missing without reason is a smaller cost.`,
    id: "selection",
    label: "Which questions",
    weight: 25,
  },
  {
    expectations: `Every wrong option's reason tells the learner in plain words why it's wrong and names the mistake behind it, and its misconception is a short neutral label of that mistake; the right option's reason says why it's right; true or false statements explain the judgment and name the trap. Everything the model wrote (not the quoted parts) is in the requested language and speaks to the learner as "you". Reasons that only restate the answer, or generic misconceptions, teach the learner nothing from a miss.`,
    id: "feedback",
    label: "Feedback on every option",
    weight: 25,
  },
  {
    expectations: `Each citation names the exam, the edition or year and the question's number as the paper gives them, in the requested language, and support texts keep the credit line of their author or source. The quoted parts read as the paper prints them, with a space between words even where the paper's text came out with words glued together. Glued words make a quoted part hard to read; a support text that lost its credit line is a smaller cost.`,
    id: "citation",
    label: "Citation, credit and copy",
    weight: 20,
  },
]);
