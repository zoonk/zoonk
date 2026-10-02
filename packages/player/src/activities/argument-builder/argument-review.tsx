"use client";

import { useExtracted } from "next-intl";
import { ArgumentText, ArgumentWhy } from "./argument-parts";

type Candidate = { id: string; isStrong: boolean; why: string };
type Quote = Candidate & { citation: string; quote: string };
type Reasoning = Candidate & { text: string };

/**
 * After the check, for each weak pick: the strong option and why it works. Which option is
 * strong comes from code's expected answer.
 */
export function ArgumentReview({
  evidence,
  picks,
  reasoning,
  strongIds,
}: {
  evidence: readonly Quote[];
  picks: { evidence: string | null; reasoning: string | null };
  reasoning: readonly Reasoning[];
  strongIds: readonly string[];
}) {
  const t = useExtracted();
  const pickedQuote = evidence.find((item) => item.id === picks.evidence);
  const pickedReasoning = reasoning.find((item) => item.id === picks.reasoning);
  const strongQuote = evidence.find((item) => strongIds.includes(item.id));
  const strongReasoning = reasoning.find((item) => strongIds.includes(item.id));

  return (
    <div className="flex flex-col gap-3" data-slot="argument-review">
      {strongQuote && strongQuote.id !== pickedQuote?.id && (
        <section className="bg-background flex flex-col gap-1.5 rounded-2xl border px-3.5 py-2.5">
          <p className="text-success text-xs font-semibold">{t("Stronger evidence")}</p>
          <ArgumentText citation={strongQuote.citation} text={strongQuote.quote} />
          <ArgumentWhy text={strongQuote.why} />
        </section>
      )}

      {strongReasoning && strongReasoning.id !== pickedReasoning?.id && (
        <section className="bg-background flex flex-col gap-1.5 rounded-2xl border px-3.5 py-2.5">
          <p className="text-success text-xs font-semibold">{t("Stronger reasoning")}</p>
          <ArgumentText text={strongReasoning.text} />
          <ArgumentWhy text={strongReasoning.why} />
        </section>
      )}
    </div>
  );
}
