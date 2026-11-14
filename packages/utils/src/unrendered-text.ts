import { findBareLatex } from "./bare-latex";
import { type TextLayout, findUnrenderedMarkdown } from "./text-flaws";

/** What a learner would see as typed: Markdown the player doesn't render, or math outside `$…$`. */
export function findUnrenderedText({
  layout,
  text,
}: {
  layout: TextLayout;
  text: string;
}): string[] {
  return [...findUnrenderedMarkdown({ layout, text }), ...findBareLatex({ layout, text })];
}
