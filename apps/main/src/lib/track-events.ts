import { track } from "@vercel/analytics";
import { type LessonKind } from "@zoonk/core/steps/contract/content";

type PlayerEventInput = { lessonId: string; lessonKind: LessonKind; stepCount: number };

/**
 * Records only submitted command-palette searches because the shared search
 * hook debounces before calling the `onSearch` callback.
 */
export function trackCommandPaletteSearch({ searchTerm }: { searchTerm: string }) {
  const trimmedSearchTerm = searchTerm.trim();

  if (!trimmedSearchTerm) {
    return;
  }

  track("Command Palette Search", { searchTerm: trimmedSearchTerm });
}

/**
 * Counts learners who reached the first playable step after the player shell
 * mounted, which is the funnel denominator for later player events.
 */
export function trackPlayerLoaded(input: PlayerEventInput) {
  track("Player Loaded", getPlayerEventData(input));
}

/**
 * Counts learners who moved beyond the first step without depending on a
 * specific step renderer or interaction type.
 */
export function trackPlayerSecondStep(input: PlayerEventInput) {
  track("Player Second Step", getPlayerEventData(input));
}

/**
 * Reports lesson completions with the client-side duration because the player
 * already owns the local lesson start timestamp before persistence runs.
 */
export function trackLessonCompleted({
  startedAt,
  ...input
}: PlayerEventInput & { startedAt: number }) {
  track("Lesson Completed", {
    ...getPlayerEventData(input),
    durationSeconds: getCompletionDurationSeconds({ startedAt }),
  });
}

/**
 * Reuses the same primitive payload shape across player events because Vercel
 * Analytics custom event properties do not support nested objects.
 */
function getPlayerEventData({ lessonId, lessonKind, stepCount }: PlayerEventInput) {
  return { lessonId, lessonKind, stepCount };
}

/**
 * Clamps client timing so clock edge cases cannot send negative durations to
 * analytics while still matching the server's whole-second completion metric.
 */
function getCompletionDurationSeconds({ startedAt }: { startedAt: number }) {
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}
