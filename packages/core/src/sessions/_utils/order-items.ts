import { type Item } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { parseItemContent } from "../../library/items/item-content";
import { type QuestionAnswer } from "../contract";
import { getShownOrder } from "./shown-order";

type OrderContent = Extract<ReturnType<typeof parseItemContent>, { format: "order" }>["content"];

export type OrderItem = Pick<Item, "id" | "language" | "skillId"> & {
  content: OrderContent;
  format: "order";
};

type BankItem = Pick<Item, "content" | "format" | "id" | "language" | "skillId">;

export function parseOrderItem(item: BankItem): OrderItem | null {
  if (item.format !== "order") {
    return null;
  }

  try {
    const parsed = parseItemContent({ content: item.content, format: item.format });

    return parsed.format === "order"
      ? { ...parsed, id: item.id, language: item.language, skillId: item.skillId }
      : null;
  } catch (error) {
    logError(`Item ${item.id} has content that doesn't match its format.`, error);
    return null;
  }
}

function getStepOrder(item: OrderItem): number[] {
  return getShownOrder({ count: item.content.steps.length, seed: item.id });
}

export function toOrderQuestion(item: OrderItem) {
  return {
    context: null,
    entry: null,
    format: item.format,
    image: null,
    itemId: item.id,
    left: null,
    options: getStepOrder(item).map((index) => item.content.steps[index] ?? ""),
    question: item.content.question,
    right: null,
    select: null,
    skillId: item.skillId,
    unit: null,
    visual: null,
  };
}

function describeSteps({ item, steps }: { item: OrderItem; steps: readonly number[] }): string {
  return steps.map((index) => item.content.steps[index] ?? "?").join(" → ");
}

/** Input order indexes refer to displayed steps; mismatched answer shapes count as wrong. */
export function gradeOrder({ answer, item }: { answer: QuestionAnswer; item: OrderItem }) {
  const shown = getStepOrder(item);
  const steps = "order" in answer ? answer.order.map((index) => shown[index] ?? -1) : [];

  const isCorrect =
    steps.length === item.content.steps.length && steps.every((step, index) => step === index);

  return {
    correctAnswer: { order: item.content.steps.map((_, index) => shown.indexOf(index)) },
    explanation: item.content.reason,
    isCorrect,
    recorded: answer,
    snapshot: {
      answer: steps.length > 0 ? describeSteps({ item, steps }) : null,
      correctAnswer: describeSteps({ item, steps: item.content.steps.map((_, index) => index) }),
      explanation: item.content.reason,
      format: item.format,
      misconception: null,
      question: item.content.question,
    },
    workedSteps: [] as string[],
  };
}
