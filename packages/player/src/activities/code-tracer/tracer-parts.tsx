"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { Check, StepBack, StepForward, X } from "lucide-react";
import { useExtracted } from "next-intl";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { ActivityCodeListing } from "../_components/activity-code";
import { type CodeLanguage } from "../_utils/highlight-code";
import { type WatchedValue } from "./tracer-steps";

/** The watched variables at this step; a value that just changed shows what it was. */
export function TracerVariables({ values }: { values: readonly WatchedValue[] }) {
  const t = useExtracted();

  return (
    <dl
      aria-label={t("Variables")}
      className="grid gap-1 font-mono"
      style={{ gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))` }}
    >
      {values.map((item) => (
        <div
          className={cn(
            "flex min-w-0 flex-col rounded-xl px-2 py-1.5",
            item.changed && "bg-viz-highlight-soft",
          )}
          key={item.name}
        >
          <dt
            className={cn(
              "text-xs wrap-anywhere",
              item.changed ? "text-viz-highlight" : "text-muted-foreground",
            )}
          >
            {item.name}
          </dt>
          {/* Values wrap rather than cut: a list or a string is what the learner traces. */}
          <dd className="text-base font-semibold wrap-anywhere tabular-nums">
            {item.changed && item.previous !== null && (
              <span className="text-viz-highlight mr-1 text-xs font-normal">
                {t("{value} →", { value: item.previous })}
              </span>
            )}
            {item.value ?? (
              <span className="text-muted-foreground font-normal">{t("not set")}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** The program with the line that just ran highlighted. */
export function TracerCode({
  code,
  currentLine,
  language,
}: {
  code: string;
  currentLine: number | null;
  language: CodeLanguage;
}) {
  const t = useExtracted();

  return (
    <ActivityCodeListing
      code={code}
      label={t("Code")}
      language={language}
      toneOf={(line) => (line === currentLine ? "current" : "plain")}
    />
  );
}

/** Step back and forward through the run, with where the run is. */
export function TracerControls({
  canGoBack,
  canGoForward,
  label,
  onBack,
  onForward,
}: {
  canGoBack: boolean;
  canGoForward: boolean;
  label: string;
  onBack: () => void;
  onForward: () => void;
}) {
  const t = useExtracted();

  return (
    <div className="flex items-center justify-between gap-2">
      <p aria-live="polite" className="text-muted-foreground text-xs font-medium tabular-nums">
        {label}
      </p>

      <div className="flex items-center gap-1.5">
        <Button
          aria-label={t("Step back")}
          disabled={!canGoBack}
          onClick={onBack}
          size="icon-lg"
          variant="outline"
        >
          <StepBack aria-hidden="true" />
        </Button>
        <Button
          aria-label={t("Step forward")}
          disabled={!canGoForward}
          onClick={onForward}
          size="icon-lg"
          variant="outline"
        >
          <StepForward aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

type PauseResult = { guess: string; isRight: boolean; question: string; traced: string };

/** Predictions already revealed: what the learner said and what the run showed. */
export function TracerPredictionLog({ results }: { results: readonly PauseResult[] }) {
  const t = useExtracted();

  if (results.length === 0) {
    return null;
  }

  return (
    <ul aria-label={t("Your predictions")} className="flex flex-col gap-1.5">
      {results.map((result) => (
        <li className="flex items-start gap-2 text-sm leading-snug" key={result.question}>
          {result.isRight ? (
            <Check aria-hidden="true" className="text-success mt-0.5 size-4 shrink-0" />
          ) : (
            <X aria-hidden="true" className="text-destructive mt-0.5 size-4 shrink-0" />
          )}
          <span className="min-w-0 flex-1">
            <span className="text-muted-foreground">
              <LessonRichText text={result.question} />
            </span>{" "}
            <span className="font-medium">
              {result.isRight
                ? t("You said {guess}, and it was.", { guess: result.guess })
                : t("You said {guess}; it was {traced}.", {
                    guess: result.guess,
                    traced: result.traced,
                  })}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
