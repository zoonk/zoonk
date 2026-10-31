import { createOnDemand } from "@zoonk/ui/lib/on-demand";
import { preloadMarkdownPlugins } from "./tutor-markdown-plugins";

export const tutorMarkdownRenderer = createOnDemand(() => import("./tutor-markdown"));

export function preloadTutorMarkdown(answers: readonly string[] = []) {
  void tutorMarkdownRenderer.load();
  preloadMarkdownPlugins(answers);
}
