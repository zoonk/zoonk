"use client";

import { useSpokenText } from "@zoonk/learn/rich-text/speech";
import { useExtracted } from "next-intl";
import { ActivityCanvasLabel } from "../_components/activity-canvas";
import { ArgumentCandidate, type ArgumentPart } from "./argument-parts";

type Quote = { citation: string; id: string; quote: string };
type Reasoning = { id: string; text: string };

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
  const spoken = useSpokenText();

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
              quote: spoken.inline(item.quote),
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
          label={t("Use as reasoning: {text}", { text: spoken.inline(item.text) })}
          onChoose={() => onChoose(item.id)}
          text={item.text}
        />
      ))}
    </div>
  );
}
