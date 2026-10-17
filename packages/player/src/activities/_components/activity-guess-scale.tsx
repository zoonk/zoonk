"use client";

import { useFormatNumber } from "@zoonk/learn/format-number";
import { Slider, SliderControl, SliderThumb, SliderTrack } from "@zoonk/ui/components/slider";
import { useMeasuredWidth } from "@zoonk/ui/hooks/measured-width";
import { cn } from "@zoonk/ui/lib/utils";
import { Lock } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  type GuessScale,
  SCALE_POSITIONS,
  roundGuess,
  scaleTicks,
  shareOfValue,
  valueAtPosition,
} from "../_utils/guess-scale";

/** Tick labels are short, so only the ones right at the ends need pulling inside. */
const TICK_EDGE_SHARE = 0.04;
const HALF = 0.5;
const PERCENT = 100;

/** Keeps a tick label centered on its point, but inside the canvas at the ends. */
function edgeAlign(share: number): string {
  if (share < TICK_EDGE_SHARE) {
    return "translate-x-0";
  }

  return share > 1 - TICK_EDGE_SHARE ? "-translate-x-full" : "-translate-x-1/2";
}

/**
 * A value's chip over its point: centered on it, but slid inside the track when it's wider than
 * the room on one side, so "Real value: 11.6 days" never hangs past the canvas.
 */
function ScaleChip({
  children,
  className,
  isLower = false,
  share,
  trackWidth,
}: {
  children: React.ReactNode;
  className?: string;
  /** The guess's chip sits under the real value's once both show. */
  isLower?: boolean;
  share: number;
  trackWidth: number;
}) {
  const { ref, width } = useMeasuredWidth<HTMLSpanElement>(0);
  const centered = share * trackWidth - width * HALF;
  const left = Math.max(0, Math.min(centered, trackWidth - width));

  return (
    <span className={cn("absolute", isLower ? "top-9" : "top-0")} ref={ref} style={{ left }}>
      <span
        className={cn(
          "flex h-7 items-center gap-1 rounded-full px-2.5 text-sm font-medium whitespace-nowrap tabular-nums",
          className,
        )}
      >
        {children}
      </span>
    </span>
  );
}

/** The stretch of track between the guess and the real value, so the gap is seen, not computed. */
function GapBand({ from, to }: { from: number; to: number }) {
  const [left, right] = [Math.min(from, to), Math.max(from, to)];

  return (
    <span
      aria-hidden="true"
      className="bg-viz-highlight-soft absolute inset-y-0 rounded-full"
      style={{ left: `${left * PERCENT}%`, width: `${(right - left) * PERCENT}%` }}
    />
  );
}

/**
 * A guess placed on a linear or log scale before anything is revealed. Once checked, the guess is
 * locked and the real value appears on the same scale with the gap between them shaded. The guess
 * is rounded to two significant digits, so it reads as a guess (3,000, never 2,871.3).
 */
export function ActivityGuessScale({
  actual,
  disabled,
  guess,
  onGuessChange,
  scale,
  unit,
}: {
  /** The real value, once it can be shown. */
  actual: number | null;
  disabled: boolean;
  guess: number | null;
  onGuessChange: (value: number) => void;
  scale: GuessScale;
  unit?: string;
}) {
  const t = useExtracted();
  const format = useFormatNumber();
  const share = guess === null ? HALF : shareOfValue(scale, guess);
  const actualShare = actual === null ? null : shareOfValue(scale, actual);
  const formatValue = (value: number) => format(value, { unit });
  const { ref: trackRef, width: trackWidth } = useMeasuredWidth<HTMLDivElement>(0);

  function handleChange(position: number) {
    onGuessChange(roundGuess(valueAtPosition(scale, position)));
  }

  return (
    <div className={cn("relative", actualShare === null ? "pt-9" : "pt-18")} ref={trackRef}>
      {actual !== null && actualShare !== null && (
        <ScaleChip
          className="bg-viz-highlight-soft text-viz-highlight motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 font-semibold"
          share={actualShare}
          trackWidth={trackWidth}
        >
          {t("Real value: {value}", { value: formatValue(actual) })}
        </ScaleChip>
      )}

      <ScaleChip
        className="bg-background ring-foreground/10 ring-1"
        isLower={actualShare !== null}
        share={share}
        trackWidth={trackWidth}
      >
        {disabled && guess !== null && <Lock aria-hidden="true" className="size-3" />}
        {guess === null
          ? t("Drag to guess")
          : t("Your guess: {value}", { value: formatValue(guess) })}
      </ScaleChip>

      <Slider
        disabled={disabled}
        max={SCALE_POSITIONS}
        min={0}
        onValueChange={(next) => handleChange(typeof next === "number" ? next : (next[0] ?? 0))}
        step={1}
        thumbAlignment="center"
        value={Math.round(share * SCALE_POSITIONS)}
      >
        {/* Once locked, the guess and the real value stay crisp: the lock says it can't move. */}
        <SliderControl className="data-disabled:opacity-100">
          <SliderTrack>
            {guess !== null && actualShare !== null && <GapBand from={share} to={actualShare} />}

            {actualShare !== null && (
              <span
                aria-hidden="true"
                className="bg-viz-highlight ring-viz-highlight-soft absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4"
                style={{ left: `${actualShare * PERCENT}%` }}
              />
            )}

            <SliderThumb
              aria-label={t("Your guess")}
              aria-valuetext={guess === null ? t("No guess yet") : formatValue(guess)}
            />
          </SliderTrack>
        </SliderControl>
      </Slider>

      <div aria-hidden="true" className="text-muted-foreground relative h-5 text-xs tabular-nums">
        {scaleTicks(scale).map((tick) => (
          <span
            className={cn("absolute top-0", edgeAlign(shareOfValue(scale, tick)))}
            key={tick}
            style={{ left: `${shareOfValue(scale, tick) * PERCENT}%` }}
          >
            {format(tick, { compact: true })}
          </span>
        ))}
      </div>
    </div>
  );
}
