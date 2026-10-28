export const SESSION_STOPPED_PARAM = "stopped";

export const SESSION_STOPPED_HREF = `/session?${SESSION_STOPPED_PARAM}=1` as const;

export function readSessionStoppedParam(value: unknown): boolean {
  return typeof value === "string" && value.length > 0;
}
