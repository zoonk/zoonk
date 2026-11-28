import { useMeasuredWidth } from "@zoonk/ui/hooks/measured-width";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useRef } from "react";

const BAR_WIDTH = 4;
const BAR_GAP = 4;
const ROW_HEIGHT = 24;
const SAMPLE_MS = 80;
const NOISE_LEVEL = 0.005;
const LOUD_LEVEL = 0.15;

type CueStatus = "acquiring" | "denied" | "idle" | "recording";

/** Bars grow with the square root of the level, so a soft voice still shows. */
function toBarHeight(level: number): number {
  const share = Math.min(1, Math.sqrt(Math.max(0, level - NOISE_LEVEL) / LOUD_LEVEL));
  return BAR_WIDTH + share * (ROW_HEIGHT - BAR_WIDTH);
}

function drawBar(bar: Element | undefined, level: number) {
  const height = toBarHeight(level);
  bar?.setAttribute("height", String(height));
  bar?.setAttribute("y", String((ROW_HEIGHT - height) / 2));
}

function useLevelBars({
  count,
  live,
  readLevel,
}: {
  count: number;
  live: boolean;
  readLevel: () => number;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const sample = useEffectEvent(readLevel);

  useEffect(() => {
    const bars = ref.current?.children;

    if (!live || !bars || globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const levels = Array.from<number>({ length: count }).fill(0);

    const timer = globalThis.setInterval(() => {
      levels.shift();
      levels.push(sample());
      levels.forEach((level, index) => drawBar(bars[index], level));
    }, SAMPLE_MS);

    return () => {
      globalThis.clearInterval(timer);
      [...bars].forEach((bar) => drawBar(bar, 0));
    };
  }, [count, live]);

  return ref;
}

function LevelTrack({ live, readLevel }: { live: boolean; readLevel: () => number }) {
  const { ref: frame, width } = useMeasuredWidth<HTMLDivElement>(0);
  const count = Math.max(0, Math.floor((width + BAR_GAP) / (BAR_WIDTH + BAR_GAP)));
  const bars = useLevelBars({ count, live, readLevel });
  const start = width - (count * (BAR_WIDTH + BAR_GAP) - BAR_GAP);

  return (
    <div className="h-6 min-w-0 flex-1" ref={frame}>
      <svg
        className={cn(
          "block h-6 w-full transition-colors",
          live ? "text-foreground" : "text-border",
        )}
        ref={bars}
      >
        {Array.from({ length: count }, (_, index) => (
          <rect
            fill="currentColor"
            height={BAR_WIDTH}
            // oxlint-disable-next-line react/no-array-index-key -- A bar is its place in the track.
            key={index}
            rx={BAR_WIDTH / 2}
            width={BAR_WIDTH}
            x={start + index * (BAR_WIDTH + BAR_GAP)}
            y={(ROW_HEIGHT - BAR_WIDTH) / 2}
          />
        ))}
      </svg>
    </div>
  );
}

// Screen reader speech during recording would be captured in the take.
export function RecordCue({
  checking = false,
  recorder,
}: {
  checking?: boolean;
  recorder: { readLevel: () => number; status: CueStatus };
}) {
  const t = useExtracted();
  const { readLevel, status } = recorder;
  const busy = status === "acquiring" || status === "recording";

  return (
    <div
      aria-hidden="true"
      className="flex h-6 w-full items-center gap-3 text-sm"
      data-slot="record-cue"
    >
      {busy && (
        <>
          <span
            className={cn(
              "shrink-0 transition-colors",
              status === "recording" ? "text-foreground font-medium" : "text-muted-foreground",
            )}
          >
            {status === "recording"
              ? t({
                  description:
                    "Shown the moment the microphone is on, telling the learner to start talking.",
                  message: "Speak now",
                })
              : t("Getting ready…")}
          </span>
          <LevelTrack live={status === "recording"} readLevel={readLevel} />
        </>
      )}

      {!busy && !checking && (
        <p className="text-muted-foreground truncate">
          {t({
            description:
              "Before recording. “Speak now” must match the cue shown when the microphone is on.",
            message: "Say it after “Speak now”",
          })}
        </p>
      )}
    </div>
  );
}
