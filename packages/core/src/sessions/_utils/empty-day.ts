import { type EmptyDay } from "./session-view";

/** Pending lessons must not turn a rest day into an awaiting-content day. */
export function toEmptyDay({
  dayMinutes,
  outlines,
}: {
  dayMinutes: number;
  outlines: "awaiting" | "idle" | null;
}): EmptyDay | null {
  if (dayMinutes === 0) {
    return null;
  }

  if (outlines === "awaiting") {
    return "lessonsComing";
  }

  return outlines === "idle" ? "lessonsToPrepare" : "nothingNew";
}
