"use client";

import { useExtracted } from "next-intl";
import { type HitResult, worstHit } from "./rhythm-results";

export function RhythmFeedback({
  extraTaps,
  hits,
}: {
  extraTaps: number;
  hits: readonly HitResult[];
}) {
  const t = useExtracted();
  const onTime = hits.filter((hit) => hit.status === "onTime").length;
  const worst = worstHit(hits);
  const tapNumber = String((worst?.index ?? 0) + 1);
  const offMs = String(Math.abs(worst?.hit.offsetMs ?? 0));

  const detail = {
    early: t({
      description: "A tap is one beat the learner taps in a rhythm activity.",
      message: "Tap {tap} came {ms} ms early.",
      values: { ms: offMs, tap: tapNumber },
    }),
    late: t({
      description: "A tap is one beat the learner taps in a rhythm activity.",
      message: "Tap {tap} came {ms} ms late.",
      values: { ms: offMs, tap: tapNumber },
    }),
    missed: t({
      description: "A tap is one beat the learner taps in a rhythm activity.",
      message: "Tap {tap} was missed.",
      values: { tap: tapNumber },
    }),
    onTime: "",
  };

  return (
    <p aria-live="polite" className="text-sm leading-snug" role="status">
      {t({
        description: "A tap is one beat the learner taps in a rhythm activity.",
        message: "{onTime} of {total, plural, =0 {# taps} one {# tap} other {# taps}} on time.",
        values: { onTime: String(onTime), total: hits.length },
      })}{" "}
      {worst && detail[worst.hit.status]}{" "}
      {extraTaps > 0 &&
        t({
          description: "A tap is one beat the learner taps in a rhythm activity.",
          message: "{count, plural, one {# extra tap.} other {# extra taps.}}",
          values: { count: extraTaps },
        })}
    </p>
  );
}
