"use client";

import { type MockResult } from "@zoonk/core/exams/mocks/contract";
import { MeterPart, MeterParts } from "@zoonk/ui/components/meter";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";

type AnswerCounts = { blank: number; partial: number; right: number; wrong: number };

function getAnswerCounts(result: MockResult): AnswerCounts | null {
  if (result.net) {
    return result.net;
  }

  if (!result.irt) {
    return null;
  }

  return {
    blank: result.blank,
    partial: 0,
    right: result.correct,
    wrong: result.total - result.correct - result.blank,
  };
}

export function hasAnswerCounts(result: MockResult): boolean {
  return getAnswerCounts(result) !== null || (!result.net && result.blank > 0);
}

function useAnswerParts(counts: AnswerCounts) {
  const t = useExtracted();

  const partial = {
    count: counts.partial,
    dot: "bg-muted-foreground/70",
    label: t("Partly right"),
    part: "bg-muted-foreground/70",
  };

  return [
    { count: counts.right, dot: "bg-success", label: t("Right"), part: "bg-success" },
    { count: counts.wrong, dot: "bg-destructive", label: t("Wrong"), part: "bg-destructive" },
    ...(counts.partial > 0 ? [partial] : []),
    {
      count: counts.blank,
      dot: "ring-muted-foreground/70 ring-1 ring-inset",
      label: t("Blank"),
      part: "",
    },
  ];
}

function AnswerMeter({ counts }: { counts: AnswerCounts }) {
  const format = useFormatter();
  const parts = useAnswerParts(counts);

  return (
    <div className="flex w-full flex-col gap-2" data-slot="mock-answers">
      <MeterParts>
        {parts
          .filter((part) => part.count > 0)
          .map((part) => (
            <MeterPart className={part.part} key={part.label} weight={part.count} />
          ))}
      </MeterParts>

      <ul className="text-muted-foreground text-2xs flex flex-wrap items-center gap-x-3 gap-y-1">
        {parts.map((part) => (
          <li className="flex items-center gap-1.5" key={part.label}>
            <span aria-hidden="true" className={cn("size-1.5 rounded-full", part.dot)} />
            {part.label}
            <span className="text-foreground font-mono tabular-nums">
              {format.number(part.count)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MockResultAnswers({ result }: { result: MockResult }) {
  const t = useExtracted();
  const counts = getAnswerCounts(result);

  if (!hasAnswerCounts(result)) {
    return null;
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {counts && <AnswerMeter counts={counts} />}
      {!result.net && result.blank > 0 && (
        <p className="text-muted-foreground text-xs">{t("Blank answers count as wrong.")}</p>
      )}
    </div>
  );
}
