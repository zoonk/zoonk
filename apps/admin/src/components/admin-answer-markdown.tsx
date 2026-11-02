"use client";

import { LessonQuestionMarkdown } from "@zoonk/player/tutor/markdown";
import Link from "next/link";

const appLinks = { Link, verified: false };

export function AdminAnswerMarkdown({ answer }: { answer: string }) {
  return (
    <LessonQuestionMarkdown
      answer={answer}
      appLinks={appLinks}
      isAnimating={false}
      isStreaming={false}
    />
  );
}
