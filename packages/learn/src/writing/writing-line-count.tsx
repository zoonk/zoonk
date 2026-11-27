"use client";

import { type WritingPrompt } from "@zoonk/core/exams/essays/writing-contract";
import { countWritingLines } from "@zoonk/core/exams/essays/writing-lines";
import { cn } from "@zoonk/ui/lib/utils";
import { countWords } from "@zoonk/utils/string";
import { useExtracted } from "next-intl";

/**
 * Whether the text fits its sheet in a typical hand, only in small handwriting, or not even then,
 * where graders stop reading.
 */
export function getWritingFit({ text, writing }: { text: string; writing: WritingPrompt }) {
  if (writing.lines === null) {
    return null;
  }

  const { estimatedLines, ignoredFrom } = countWritingLines({
    charactersPerLine: writing.charactersPerLine,
    denseCharactersPerLine: writing.denseCharactersPerLine,
    limit: writing.lines,
    text,
  });

  const lines = writing.lines;

  if (ignoredFrom !== null) {
    return { estimatedLines, fit: "over", lines } as const;
  }

  return { estimatedLines, fit: estimatedLines > lines ? "small" : "fits", lines } as const;
}

/**
 * "about 23 of 30 lines": the count stays in view under the field, and past the limit it says
 * whether the text fits only in small handwriting or its end won't be read.
 */
export function WritingLineCount({
  id,
  text,
  writing,
}: {
  id?: string;
  text: string;
  writing: WritingPrompt;
}) {
  const t = useExtracted();
  const count = getWritingFit({ text, writing });

  if (count === null) {
    return (
      <p className="text-muted-foreground font-mono text-xs tabular-nums" id={id}>
        {t("{count, plural, one {# word} other {# words}}", { count: countWords(text) })}
      </p>
    );
  }

  const values = { lines: String(count.lines), used: String(count.estimatedLines) };

  const countLine = () => {
    if (!text.trim()) {
      return t("0 of {lines} lines", { lines: values.lines });
    }

    if (count.fit === "small") {
      return t({
        description:
          "The approximate line count of a written answer past its limit at a typical hand; it fits the exam's answer sheet only if the learner writes small.",
        message: "about {used} of {lines} lines · fits only in small handwriting",
        values,
      });
    }

    if (count.fit === "over") {
      return t({
        description:
          "The approximate line count of a written answer that won't fit the exam's answer sheet even in small handwriting; graders stop reading at the last line.",
        message: "about {used} of {lines} lines · the end won't be read",
        values,
      });
    }

    return t("about {used} of {lines} lines", values);
  };

  return (
    <p
      aria-live="polite"
      className={cn(
        "font-mono text-xs tabular-nums",
        count.fit === "over" ? "text-warning-text" : "text-muted-foreground",
      )}
      id={id}
    >
      {countLine()}
    </p>
  );
}
