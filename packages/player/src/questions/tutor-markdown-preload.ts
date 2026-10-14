import { createOnDemand } from "@zoonk/ui/lib/on-demand";
import { preloadMarkdownPlugins } from "./tutor-markdown-plugins";

/** The answers' renderer (Streamdown and its Markdown parser), its own chunk. */
export const tutorMarkdownRenderer = createOnDemand(() => import("./tutor-markdown"));

/**
 * Starts loading the answers' renderer, and the math or diagrams `answers` will need, before they
 * show: when a conversation is about to open or already has answers to draw.
 */
export function preloadTutorMarkdown(answers: readonly string[] = []) {
  void tutorMarkdownRenderer.load();
  preloadMarkdownPlugins(answers);
}
