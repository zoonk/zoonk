"use client";

import { CodeLabelsContext } from "@zoonk/learn/code";
import { LessonQuestionMarkdown } from "@zoonk/player/tutor/markdown";
import Link from "next/link";

const appLinks = { Link, verified: false };

const CODE_LABELS = { code: "Code", scrollLeft: "Scroll left", scrollRight: "Scroll right" };

export function AdminAnswerMarkdown({ answer }: { answer: string }) {
  return (
    <CodeLabelsContext value={CODE_LABELS}>
      <LessonQuestionMarkdown
        answer={answer}
        appLinks={appLinks}
        isAnimating={false}
        isStreaming={false}
      />
    </CodeLabelsContext>
  );
}
