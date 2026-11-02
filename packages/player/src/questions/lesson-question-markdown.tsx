"use client";

import "katex/dist/katex.min.css";
import { type ComponentProps } from "react";
import { type TutorMarkdown } from "./tutor-markdown";
import { tutorMarkdownRenderer } from "./tutor-markdown-preload";

function PlainAnswer({ answer }: { answer: string }) {
  return <p className="min-w-0 wrap-anywhere whitespace-pre-wrap">{answer}</p>;
}

export function LessonQuestionMarkdown(props: ComponentProps<typeof TutorMarkdown>) {
  const renderer = tutorMarkdownRenderer.useModule();

  if (!renderer) {
    return <PlainAnswer answer={props.answer} />;
  }

  const Renderer = renderer.TutorMarkdown;

  return <Renderer {...props} />;
}
