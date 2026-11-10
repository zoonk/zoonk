import { type gradeTypedAnswer } from "@zoonk/ai/tasks/grading/grade-typed-answer";

export function typedGrade({
  feedback,
  isCorrect,
  score,
}: {
  feedback: string;
  isCorrect: boolean;
  score: number;
}): Awaited<ReturnType<typeof gradeTypedAnswer>> {
  return {
    data: {
      corrections: [],
      feedback,
      isCorrect,
      keyPoints: [{ met: isCorrect, text: "The cloud shows where it's likely to be found" }],
      method: "model",
      score,
      spelling: null,
    },
    provenance: null,
    systemPrompt: "",
    usage: null,
    userPrompt: "",
  };
}
