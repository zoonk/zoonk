"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";

/** The message's words, the sentence playing now marked. */
export function ListeningTranscript({
  current,
  sentences,
}: {
  current: number | null;
  sentences: readonly string[];
}) {
  const t = useExtracted();

  return (
    <div className="bg-background flex flex-col gap-1 rounded-2xl px-4 py-3">
      <p className="text-muted-foreground text-xs font-medium">{t("The words")}</p>
      <p className="text-base leading-relaxed">
        {sentences.map((sentence, index) => (
          <span
            className={cn(current === index && "bg-viz-accent-soft rounded")}
            key={`${String(index)}-${sentence}`}
          >
            {index < sentences.length - 1 ? `${sentence} ` : sentence}
          </span>
        ))}
      </p>
    </div>
  );
}
