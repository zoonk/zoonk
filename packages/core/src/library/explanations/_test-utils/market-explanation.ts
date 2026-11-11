import { type QuickExplanation } from "@zoonk/ai/tasks/explain/quick-explanation";

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
    description: "What a market index measures and what a 2% rise compares with.",
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
        image: {
          alt: "A scale holding a basket of company logos, the biggest logos taking most of the room",
          prompt: "A basket of company logos on a scale",
        },
        text: "“The market” is an **index**.",
        title: "The market isn't one price",
      },
      {
        image: null,
        text: "Each company counts by its size.",
        title: "Bigger companies weigh more",
      },
      { image: null, text: "It compares now with yesterday's close.", title: "Up 2% since when?" },
      { image: null, text: "An index fund follows the basket.", title: "Why it matters to you" },
    ],
    title: "What “the market is up 2%” means",
  };
}
