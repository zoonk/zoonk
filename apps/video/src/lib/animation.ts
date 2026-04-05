import { type CSSProperties } from "react";
import { Easing, interpolate, spring } from "remotion";

/**
 * Standard entry easing — strong ease-out with a natural deceleration.
 * Used for all element entrances throughout the video.
 */
const ENTRY_EASING = Easing.bezier(0.16, 1, 0.3, 1);

/**
 * Standard exit easing — quick ease-in for fast, clean departures.
 */
const EXIT_EASING = Easing.bezier(0.7, 0, 0.84, 0);

/**
 * Standard entry animation: scale 95% -> 100% + opacity 0 -> 1.
 * Every isolated UI element in the video uses this to appear.
 * Returns a style object ready to spread onto a div.
 */
export function entryScale({
  frame,
  delay = 0,
  duration = 12,
}: {
  frame: number;
  delay?: number;
  duration?: number;
}): CSSProperties {
  const progress = interpolate(frame - delay, [0, duration], [0, 1], {
    easing: ENTRY_EASING,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return {
    opacity: progress,
    transform: `scale(${interpolate(progress, [0, 1], [0.95, 1])})`,
  };
}

/**
 * Standard exit animation: opacity 1 -> 0.
 * Used when elements need to dissolve out before a scene ends.
 */
export function exitFade({
  frame,
  start,
  duration = 8,
}: {
  frame: number;
  start: number;
  duration?: number;
}): CSSProperties {
  const opacity = interpolate(frame - start, [0, duration], [1, 0], {
    easing: EXIT_EASING,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return { opacity };
}

/**
 * Smooth spring animation with no bounce.
 * Returns a 0-1 progress value — ideal for drawing/filling animations
 * like timeline strokes and progress bars.
 */
export function smoothSpring({
  frame,
  fps,
  delay = 0,
  durationInFrames,
}: {
  frame: number;
  fps: number;
  delay?: number;
  durationInFrames?: number;
}): number {
  return spring({
    config: { damping: 200 },
    durationInFrames,
    fps,
    frame: frame - delay,
  });
}

/**
 * Typewriter effect — reveals text character by character with a blinking cursor.
 * Returns the visible portion of the text and the cursor opacity.
 */
export function typewriter({
  frame,
  text,
  startFrame = 0,
  framesPerChar = 2,
}: {
  frame: number;
  text: string;
  startFrame?: number;
  framesPerChar?: number;
}): { visibleText: string; cursorOpacity: number } {
  const elapsed = Math.max(0, frame - startFrame);
  const charCount = Math.min(text.length, Math.floor(elapsed / framesPerChar));
  const visibleText = text.slice(0, charCount);

  /** Cursor blinks on a 16-frame cycle (visible for 10, hidden for 6). */
  const cursorOpacity = elapsed % 16 < 10 ? 1 : 0;

  return { cursorOpacity, visibleText };
}

/**
 * Animates a number counting up from `from` to `to` between two frame points.
 * Returns the current integer value — used for BP counters, stats, streaks.
 */
export function countUp({
  frame,
  startFrame,
  endFrame,
  from,
  to,
}: {
  frame: number;
  startFrame: number;
  endFrame: number;
  from: number;
  to: number;
}): number {
  const value = interpolate(frame, [startFrame, endFrame], [from, to], {
    easing: Easing.out(Easing.quad),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return Math.round(value);
}

/**
 * Returns the delay in frames for the nth item in a staggered sequence.
 * Used when multiple elements (chapter cards, word banks) enter one after another.
 */
export function stagger({
  index,
  baseDelay = 0,
  gap = 4,
}: {
  index: number;
  baseDelay?: number;
  gap?: number;
}): number {
  return baseDelay + index * gap;
}
