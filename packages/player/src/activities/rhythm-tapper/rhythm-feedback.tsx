"use client";

import { useExtracted } from "next-intl";
import { type HitResult, worstHit } from "./rhythm-results";

/**
 * How the taps went, in words: how many were on time and the one furthest off. It reads the
 * same per-tap judgment the dots show.
 */
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
    early: t("Tap {tap} came {ms} ms early.", { ms: offMs, tap: tapNumber }),
    late: t("Tap {tap} came {ms} ms late.", { ms: offMs, tap: tapNumber }),
    missed: t("Tap {tap} was missed.", { tap: tapNumber }),
    onTime: "",
  };

  return (
    <p aria-live="polite" className="text-sm leading-snug" role="status">
      {t("{onTime} of {total} taps on time.", {
        onTime: String(onTime),
        total: String(hits.length),
      })}{" "}
      {worst && detail[worst.hit.status]}{" "}
      {extraTaps > 0 &&
        t("{count, plural, one {# extra tap.} other {# extra taps.}}", { count: extraTaps })}
    </p>
  );
}
