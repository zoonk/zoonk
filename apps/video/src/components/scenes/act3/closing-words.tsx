import { SceneContainer } from "@/components/scene-container";
import { COLORS } from "@/lib/constants";
import { Easing, interpolate, useCurrentFrame } from "remotion";

/**
 * Word timing: each word appears alone, then fades for the next.
 * "YOU." hold 24 frames (800ms) -> "CAN." hold 18 frames (600ms) ->
 * "LEARN." hold 15 frames (500ms) -> "ANYTHING." hold 36 frames (1200ms).
 * The acceleration creates momentum; the final hold creates weight.
 */
const WORDS = [
  { text: "YOU.", size: 48, holdFrames: 24 },
  { text: "CAN.", size: 56, holdFrames: 18 },
  { text: "LEARN.", size: 64, holdFrames: 15 },
  { text: "ANYTHING.", size: 72, holdFrames: 36 },
] as const;

const FADE_IN = 8;
const FADE_OUT = 6;

/**
 * "YOU. CAN. LEARN. ANYTHING." — one word at a time, each larger.
 * ALL CAPS, Geist Bold 700. The only place in the video that uses caps.
 * Each word replaces the previous. Heartbeat timing at ~60 BPM.
 */
export function ClosingWords() {
  const frame = useCurrentFrame();

  /** Calculate start frame for each word based on accumulated durations. */
  const wordTimings = getWordTimings();
  const activeIndex = getActiveWord(frame, wordTimings);

  /** After all words, dissolve the last one for the logo transition. */
  const lastTiming = wordTimings[wordTimings.length - 1];
  const lastEnd = lastTiming ? lastTiming.end : 0;
  const dissolveOpacity = interpolate(frame, [lastEnd, lastEnd + 30], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneContainer bg="white">
      {WORDS.map((word, index) => {
        const timing = wordTimings[index];
        if (!timing) return null;

        /** Fade in at start, hold, then fade out before next word. */
        const fadeIn = interpolate(frame, [timing.start, timing.start + FADE_IN], [0, 1], {
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        const fadeOut =
          index < WORDS.length - 1
            ? interpolate(frame, [timing.end - FADE_OUT, timing.end], [1, 0], {
                easing: Easing.bezier(0.7, 0, 0.84, 0),
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })
            : dissolveOpacity;

        const opacity = Math.min(fadeIn, fadeOut);
        const isVisible = frame >= timing.start && (index === activeIndex || opacity > 0);

        if (!isVisible) return null;

        const scale = interpolate(frame, [timing.start, timing.start + FADE_IN], [0.95, 1], {
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <span
            key={word.text}
            style={{
              position: "absolute",
              fontSize: word.size,
              fontWeight: 700,
              color: COLORS.text,
              letterSpacing: 4,
              textTransform: "uppercase",
              opacity,
              transform: `scale(${scale})`,
            }}
          >
            {word.text}
          </span>
        );
      })}
    </SceneContainer>
  );
}

function getWordTimings(): Array<{ start: number; end: number }> {
  const timings: Array<{ start: number; end: number }> = [];
  let currentFrame = 8;

  for (const word of WORDS) {
    const start = currentFrame;
    const end = start + FADE_IN + word.holdFrames;
    timings.push({ start, end });
    currentFrame = end;
  }

  return timings;
}

function getActiveWord(
  frame: number,
  timings: Array<{ start: number; end: number }>,
): number {
  for (let i = timings.length - 1; i >= 0; i--) {
    const timing = timings[i];
    if (timing && frame >= timing.start) return i;
  }
  return 0;
}
