import { useEffect, useState } from "react";
import { type StudySessionSummary } from "../session-types";

/** The summary the learner last saw celebrate: its session and the Brain Power it showed. */
const CELEBRATED_KEY = "zoonk:summary-celebrated";

function readCelebrated(): string | null {
  try {
    return globalThis.localStorage.getItem(CELEBRATED_KEY);
  } catch {
    return null;
  }
}

function writeCelebrated(key: string) {
  try {
    globalThis.localStorage.setItem(CELEBRATED_KEY, key);
  } catch {
    // Without storage, a revisit celebrates again, as it did before this was kept.
  }
}

/**
 * Whether the learner sees this summary for the first time, so what it earned counts up once:
 * opened again from Today's "See today's summary", it's still, until the day earns more.
 */
export function useFirstSummaryVisit({
  brainPower,
  sessionId,
}: Pick<StudySessionSummary, "brainPower" | "sessionId">): boolean {
  const key = `${sessionId}:${brainPower}`;
  // oxlint-disable-next-line react/hook-use-state -- Read once as the summary opens, never updated.
  const [first] = useState(() => readCelebrated() !== key);

  useEffect(() => {
    writeCelebrated(key);
  }, [key]);

  return first;
}
