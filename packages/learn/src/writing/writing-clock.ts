import { MAX_WRITING_MS } from "@zoonk/core/exams/essays/contract";

/**
 * Time spent writing: from the first keystroke, only while the page is in view, bounded to what the
 * server accepts. It reads `performance.now()`, a clock a change to the device's time can't move.
 */
export function createWritingClock() {
  let total = 0;
  let since: number | null = null;
  let started = false;

  return {
    durationMs: () => {
      const running = since === null ? 0 : performance.now() - since;
      return Math.round(Math.min(MAX_WRITING_MS, Math.max(0, total + running)));
    },
    hidden: () => {
      if (since !== null) {
        total += performance.now() - since;
        since = null;
      }
    },
    reset: () => {
      total = 0;
      since = null;
      started = false;
    },
    typed: ({ visible }: { visible: boolean }) => {
      started = true;

      if (visible) {
        since ??= performance.now();
      }
    },
    visible: () => {
      if (started) {
        since ??= performance.now();
      }
    },
  };
}
