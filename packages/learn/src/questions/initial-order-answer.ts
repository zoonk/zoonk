export function initialOrderAnswer(
  question?: { format: string; options?: readonly string[] | null } | null,
) {
  return question?.format === "order" && question.options?.length
    ? { order: question.options.map((_, index) => index) }
    : null;
}
