import itemRules from "./item-rules.prompt.md";

/**
 * Every item writer's prompt: its own role and goal, then the rules all of them share (what makes
 * a good question, exam style, text and tables, each format and the final check), so a rule
 * changes in one place for every task that writes bank items.
 */
export function withItemRules(taskPrompt: string): string {
  return `${taskPrompt}\n${itemRules}`;
}
