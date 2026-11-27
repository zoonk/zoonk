"use client";

import { type WritingResult } from "@zoonk/core/exams/essays/writing-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { PageSectionDetail, PageSectionHeader, PageSectionTitle } from "../_components/page";
import { StepRow, StepRows } from "../_components/step-card";

type Mark = { error: number | null; ignored: boolean; step: boolean };

type Piece = Mark & { end: number; start: number };

/** Offsets are UTF-16 code units into the saved text, as the grade's `start` and `ignoredFrom`. */
function cutText({ grade, text }: { grade: WritingResult; text: string }): Piece[] {
  const stepQuote = grade.nextStep?.quote;
  const stepStart = stepQuote ? text.indexOf(stepQuote) : -1;

  const ignoredFrom = Math.min(grade.ignoredFrom ?? text.length, text.length);

  const cuts = new Set([0, text.length, ignoredFrom]);

  grade.errors.forEach(({ quote, start }) => {
    cuts.add(start);
    cuts.add(Math.min(text.length, start + quote.length));
  });

  if (stepQuote && stepStart >= 0) {
    cuts.add(stepStart);
    cuts.add(stepStart + stepQuote.length);
  }

  const points = [...cuts].filter((cut) => cut <= text.length).toSorted((a, b) => a - b);

  return points.slice(0, -1).map((start, index) => {
    const end = points[index + 1] ?? text.length;

    const error = grade.errors.findIndex(
      (item) => start >= item.start && start < item.start + item.quote.length,
    );

    return {
      end,
      error: error === -1 ? null : error,
      ignored: start >= ignoredFrom,
      start,
      step:
        stepQuote !== undefined &&
        stepQuote !== null &&
        stepStart >= 0 &&
        start >= stepStart &&
        start < stepStart + stepQuote.length,
    };
  });
}

function isErrorEnd(pieces: Piece[], index: number): boolean {
  const piece = pieces[index];
  return piece?.error !== null && pieces[index + 1]?.error !== piece?.error;
}

/** The learner's text as sent, with each language error marked and numbered, and what graders wouldn't read set apart. */
export function WritingMarkedText({
  grade,
  lines,
  text,
}: {
  grade: WritingResult;
  lines: number | null;
  text: string;
}) {
  const t = useExtracted();
  const pieces = cutText({ grade, text });
  const errorCount = grade.errors.length;

  return (
    <section className="flex flex-col gap-3" data-slot="writing-text">
      <PageSectionHeader>
        <PageSectionTitle>{t("Your text")}</PageSectionTitle>
        {errorCount > 0 && (
          <PageSectionDetail className="font-mono tabular-nums">
            {t("{count, plural, one {# error} other {# errors}}", { count: errorCount })}
          </PageSectionDetail>
        )}
      </PageSectionHeader>

      <p className="text-reading leading-relaxed wrap-break-word whitespace-pre-wrap">
        {pieces.map((piece, index) => {
          const content = text.slice(piece.start, piece.end);
          const startsIgnored = piece.ignored && !pieces[index - 1]?.ignored;

          return (
            <span key={piece.start}>
              {startsIgnored && (
                <span className="text-warning-text my-2 block font-mono text-xs" role="note">
                  {lines
                    ? t("Past line {lines}: graders stop reading here", { lines: String(lines) })
                    : t("Past the limit: graders stop reading here")}
                </span>
              )}
              <span
                className={cn(
                  piece.error !== null &&
                    "bg-destructive/10 decoration-destructive underline decoration-1 underline-offset-4",
                  piece.step &&
                    "decoration-warning underline decoration-wavy decoration-1 underline-offset-4",
                  piece.ignored && "text-muted-foreground line-through decoration-1",
                )}
              >
                {content}
              </span>
              {piece.error !== null && isErrorEnd(pieces, index) && (
                <sup className="text-destructive-text ms-0.5 font-mono text-xs">
                  {piece.error + 1}
                  <span className="sr-only">{t(", language error")}</span>
                </sup>
              )}
            </span>
          );
        })}
      </p>

      {errorCount > 0 && (
        <StepRows aria-label={t("Language errors")}>
          {grade.errors.map((error, index) => (
            <StepRow className="items-start" key={`${error.start}-${error.quote}`}>
              <span className="text-muted-foreground ring-border flex size-5 shrink-0 items-center justify-center rounded-sm font-mono text-xs ring-1 ring-inset">
                {index + 1}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-pretty">{error.correction}</span>
                <span className="text-muted-foreground text-xs text-pretty">
                  {t({
                    description:
                      'Under a correction: what the learner wrote, then the kind of error, like "grammar".',
                    message: "You wrote “{quote}” ({kind})",
                    values: { kind: error.kind, quote: error.quote },
                  })}
                </span>
              </span>
            </StepRow>
          ))}
        </StepRows>
      )}
    </section>
  );
}
