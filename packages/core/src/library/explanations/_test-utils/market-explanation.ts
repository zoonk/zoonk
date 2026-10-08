import { type QuickExplanation } from "@zoonk/ai/tasks/v2/explain/quick-explanation";

/** A quick explanation that passes every check, as the fast model writes one. */
export function marketExplanation(): QuickExplanation {
  return {
    check: {
      options: [
        {
          feedback: "Yes: the index is a basket of stocks.",
          isCorrect: true,
          text: "The basket is worth 2% more",
        },
        {
          feedback: "No: most stocks can fall on an up day.",
          isCorrect: false,
          text: "Every stock rose 2%",
        },
        {
          feedback: "No: points are only the index's unit.",
          isCorrect: false,
          text: "The index gained 2 points",
        },
      ],
      question: "The market is up 2% today. What happened?",
    },
    goFurther: {
      overviewCourse: "How the stock market works",
      relatedQuestions: ["What is an index fund?", "Why do stocks fall?"],
    },
    recap: [
      "The market is an index.",
      "Big companies weigh more.",
      "Up 2% compares with yesterday's close.",
    ],
    screens: [
      {
        imagePrompt: "A basket of company logos on a scale",
        text: "“The market” is an **index**.",
        title: "The market isn't one price",
      },
      {
        imagePrompt: null,
        text: "Each company counts by its size.",
        title: "Bigger companies weigh more",
      },
      {
        imagePrompt: null,
        text: "It compares now with yesterday's close.",
        title: "Up 2% since when?",
      },
      {
        imagePrompt: null,
        text: "An index fund follows the basket.",
        title: "Why it matters to you",
      },
    ],
    title: "What “the market is up 2%” means",
  };
}
