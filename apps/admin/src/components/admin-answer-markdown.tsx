"use client";

import { readCodeLine } from "@zoonk/learn/code/spoken";
import { LessonQuestionMarkdown } from "@zoonk/player/tutor/markdown";
import Link from "next/link";

const appLinks = { Link, verified: false };

/** The learner's reading of a line of code, in English, since Admin loads no translations. */
function speakLine(text: string, number: number): string {
  const { code, indent } = readCodeLine(text);
  const runs = indent.map(({ count, kind }) => `${count} ${kind}${count === 1 ? "" : "s"}`);

  if (!code) {
    return `Line ${number}: blank`;
  }

  return runs.length > 0
    ? `Line ${number}, indented ${runs.join(", ")}: ${code}`
    : `Line ${number}: ${code}`;
}

const codeLabels = { code: "Code", line: speakLine };

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
