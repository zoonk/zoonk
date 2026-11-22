import { type GeneratedItem } from "./item-schemas";

export type RecallQuestion = { question: string; answer: string | null };

function lines(values: readonly (string | null | undefined)[]): string {
  return values.filter(Boolean).join("\n");
}

export function toRecallQuestion(item: GeneratedItem): RecallQuestion {
  switch (item.format) {
    case "trueFalse":
      return {
        answer: item.isTrue ? "true" : "false",
        question: lines([item.context, item.statement]),
      };
    case "multipleChoice":
      return {
        answer: item.options
          .flatMap((option) => (option.isCorrect ? [option.text] : []))
          .join("; "),
        question: lines([
          item.context,
          item.question,
          ...item.options.map((option) => `- ${option.text}`),
        ]),
      };
    case "typed":
    case "spoken":
      return { answer: item.sampleAnswer, question: lines([item.context, item.question]) };
    case "essay":
      return { answer: null, question: lines([item.context, item.question]) };
    case "numeric":
      return {
        answer: `${item.math.answer}${item.math.unit ? ` ${item.math.unit}` : ""}`,
        question: lines([item.context, item.question]),
      };
    case "matchPairs":
      return {
        answer: item.pairs.map((pair) => `${pair.left} = ${pair.right}`).join("; "),
        question: item.question,
      };
    case "order":
      return { answer: item.steps.join(" > "), question: item.question };
    default:
      throw new Error("Unknown item format.");
  }
}
