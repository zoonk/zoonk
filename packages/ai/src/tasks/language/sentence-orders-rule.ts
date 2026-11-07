import sentenceOrdersRule from "./sentence-orders.prompt.md";

/** The lesson writer and the repair of older lessons judge other word orders by the same rule. */
export function withSentenceOrdersRule(template: string): string {
  return template.replace("{{SENTENCE_ORDERS}}\n", () => sentenceOrdersRule);
}
