import { type GeneratedItem } from "@zoonk/ai/tasks/items/schemas";
import { safeParseStepContent } from "../contract/step-contract";

export function toCheckQuestion(
  content: unknown,
): Extract<GeneratedItem, { format: "multipleChoice" }> | null {
  const parsed = safeParseStepContent("check", content);

  if (
    !parsed.success ||
    parsed.data.image ||
    parsed.data.options.some((option) => option.picture)
  ) {
    return null;
  }

  const { context, options, question, visual } = parsed.data;

  return {
    context: context ?? null,
    difficulty: "medium",
    fixedOrder: false,
    format: "multipleChoice",
    image: null,
    options: options.map(({ isCorrect, reason, text }) => ({
      isCorrect,
      misconception: null,
      reason,
      text,
    })),
    question,
    visual: visual ?? null,
  };
}
