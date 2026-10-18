"use client";

import { useExtracted } from "next-intl";
import { ActivityCanvasLabel } from "../_components/activity-canvas";
import { ArgumentCandidate, type ArgumentPart } from "./argument-parts";

type Quote = { citation: string; id: string; quote: string };
type Reasoning = { id: string; text: string };

/** The options for the part waiting for a pick: the quotes first, then the reasoning. */
export function ArgumentCandidates({
  evidence,
  onChoose,
  part,
  reasoning,
}: {
  evidence: readonly Quote[];
  onChoose: (itemId: string) => void;
  part: ArgumentPart;
  reasoning: readonly Reasoning[];
}) {
  const t = useExtracted();

  if (part === "evidence") {
    return (
      <div className="flex flex-col gap-2">
        <ActivityCanvasLabel className="font-medium">{t("Quotes")}</ActivityCanvasLabel>
        {evidence.map((item) => (
          <ArgumentCandidate
            citation={item.citation}
            disabled={false}
            id={item.id}
            key={item.id}
            label={t("Use as evidence: {quote}, {citation}", {
              citation: item.citation,
              quote: item.quote,
            })}
            onChoose={() => onChoose(item.id)}
            text={item.quote}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ActivityCanvasLabel className="font-medium">{t("Reasoning")}</ActivityCanvasLabel>
      {reasoning.map((item) => (
        <ArgumentCandidate
          disabled={false}
          id={item.id}
          key={item.id}
          label={t("Use as reasoning: {text}", { text: item.text })}
          onChoose={() => onChoose(item.id)}
          text={item.text}
        />
      ))}
    </div>
  );
}
