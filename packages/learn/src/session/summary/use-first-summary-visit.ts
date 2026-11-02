import { useEffect, useState } from "react";
import { deviceStorage } from "../../_utils/device-storage";
import { type StudySessionSummary } from "../session-types";

const CELEBRATED_KEY = "zoonk:summary-celebrated";

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
