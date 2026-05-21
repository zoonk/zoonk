import richTextPrompt from "./lesson-rich-text.prompt.md";

/**
 * Appends the player rich-text contract to lesson prompts that generate learner
 * copy. Explanation, tutorial, and practice lessons all render through the same
 * player text component, so keeping the formatting rules here prevents one
 * lesson kind from drifting away from what the player actually supports.
 */
export function appendLessonRichTextPrompt(basePrompt: string): string {
  return `${basePrompt.trimEnd()}\n\n${richTextPrompt.trim()}`;
}
