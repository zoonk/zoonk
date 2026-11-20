"use client";

import { LessonQuestionMarkdown } from "@zoonk/player/tutor/markdown";
import Link from "next/link";

const appLinks = { Link, verified: false };

const codeLabels = { code: "Code", scroll: { left: "Scroll left", right: "Scroll right" } };

export function AdminAnswerMarkdown({ answer }: { answer: string }) {
  return (
    <LessonQuestionMarkdown
      answer={answer}
      appLinks={appLinks}
      codeLabels={codeLabels}
      isAnimating={false}
      isStreaming={false}
    />
  );
}
