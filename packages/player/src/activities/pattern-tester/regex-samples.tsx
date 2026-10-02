"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { Check, X } from "lucide-react";
import { useExtracted } from "next-intl";
import { keyedByPosition } from "../_utils/position-keys";
import { type SampleResult, countPassing } from "./pattern-results";

/** The sample with the part the pattern matched marked, so the learner sees what it found. */
function MarkedSample({ result, shouldMatch }: { result: SampleResult; shouldMatch: boolean }) {
  const { match, sample } = result;

  if (!match || match.end === match.start) {
    return <span className="whitespace-pre">{sample}</span>;
  }

  return (
    <span className="whitespace-pre">
      {sample.slice(0, match.start)}
      <mark
        className={cn(
          "rounded px-px",
          shouldMatch ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
        )}
      >
        {sample.slice(match.start, match.end)}
      </mark>
      {sample.slice(match.end)}
    </span>
  );
}

function SampleRow({ result, shouldMatch }: { result: SampleResult; shouldMatch: boolean }) {
  const t = useExtracted();

  const status = (() => {
    if (result.passes) {
      return shouldMatch ? t("matches") : t("doesn't match");
    }

    return shouldMatch ? t("no match") : t("matched");
  })();

  return (
    <li
      className={cn(
        "bg-background flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 font-mono text-base",
        !result.passes && "border-destructive/50 bg-destructive/10",
      )}
    >
      <MarkedSample result={result} shouldMatch={shouldMatch} />
      <span className="sr-only">{`, ${status}`}</span>

      <span aria-hidden="true" className="ml-auto flex shrink-0 items-center gap-1.5">
        {!result.passes && (
          <span className="text-destructive font-sans text-xs font-medium">{status}</span>
        )}
        {result.passes ? (
          <Check className="text-success size-[18px]" />
        ) : (
          <X className="text-destructive size-[18px]" />
        )}
      </span>
    </li>
  );
}

/**
 * One list of examples, "should match" or "should not match", with how many pass. Before the
 * learner types anything (or while the pattern can't run), the examples show without results.
 */
export function RegexSampleList({
  label,
  results,
  samples,
  shouldMatch,
}: {
  label: string;
  results: readonly SampleResult[] | null;
  samples: readonly string[];
  shouldMatch: boolean;
}) {
  const t = useExtracted();
  const passing = results ? countPassing(results) : null;

  return (
    <section aria-label={label} className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">{label}</p>

        {passing !== null && (
          <p
            className={cn(
              "text-xs tabular-nums",
              passing === samples.length ? "text-muted-foreground" : "text-destructive font-medium",
            )}
          >
            {t("{passing} of {total} pass", {
              passing: String(passing),
              total: String(samples.length),
            })}
          </p>
        )}
      </div>

      <ul className="flex flex-col gap-1.5">
        {results
          ? keyedByPosition(results, (result) => result.sample).map(({ item, key }) => (
              <SampleRow key={key} result={item} shouldMatch={shouldMatch} />
            ))
          : keyedByPosition(samples, (sample) => sample).map(({ item, key }) => (
              <li
                className="bg-background flex min-h-11 items-center rounded-xl border px-3 py-2 font-mono text-base whitespace-pre"
                key={key}
              >
                {item}
              </li>
            ))}
      </ul>
    </section>
  );
}
