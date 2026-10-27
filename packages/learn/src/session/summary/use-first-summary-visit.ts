import { useEffect, useState } from "react";
import { deviceStorage } from "../../_utils/device-storage";
import { type StudySessionSummary } from "../session-types";

/** The summary the learner last saw celebrate: its session and the Brain Power it showed. */
const CELEBRATED_KEY = "zoonk:summary-celebrated";

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
  const [first] = useState(() => deviceStorage.get(CELEBRATED_KEY) !== key);

  useEffect(() => {
    deviceStorage.set(CELEBRATED_KEY, key);
  }, [key]);

  return first;
}
