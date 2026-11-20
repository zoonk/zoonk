"use client";

import { LessonQuestionMarkdown } from "@zoonk/player/tutor/markdown";
import { NextIntlClientProvider } from "next-intl";
import Link from "next/link";

const appLinks = { Link, verified: false };

/** Admin reads in English, so the answer's labels, such as a code block's, show as written. */
export function AdminAnswerMarkdown({ answer }: { answer: string }) {
  return (
    <NextIntlClientProvider locale="en">
      <LessonQuestionMarkdown
        answer={answer}
        appLinks={appLinks}
        isAnimating={false}
        isStreaming={false}
      />
    </NextIntlClientProvider>
  );
}
