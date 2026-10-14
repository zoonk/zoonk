"use client";

// KaTeX's styles load with the tutor's answers, the only place math renders as HTML, not on every page.
import "katex/dist/katex.min.css";
import { type ComponentProps } from "react";
import { type TutorMarkdown } from "./tutor-markdown";
import { tutorMarkdownRenderer } from "./tutor-markdown-preload";

/** An answer as plain text: until its renderer arrives, or where it couldn't load at all. */
function PlainAnswer({ answer }: { answer: string }) {
  return <p className="min-w-0 wrap-anywhere whitespace-pre-wrap">{answer}</p>;
}

/**
 * A tutor's answer drawn from its Markdown. The renderer (Streamdown and its Markdown parser) is
 * its own chunk, so a screen downloads it only once it shows an answer, or is about to
 * (`preloadTutorMarkdown`); once here, answers draw at once. Server rendering and hydration wait
 * for it (the page's HTML is the answer as drawn), and so does a thread's first look under its
 * skeleton. Anywhere else, an answer arriving before the renderer shows as plain text for that
 * moment rather than hiding the screen it's on.
 */
export function LessonQuestionMarkdown(props: ComponentProps<typeof TutorMarkdown>) {
  const renderer = tutorMarkdownRenderer.useModule();

  if (!renderer) {
    return <PlainAnswer answer={props.answer} />;
  }

  const Renderer = renderer.TutorMarkdown;

  return <Renderer {...props} />;
}
