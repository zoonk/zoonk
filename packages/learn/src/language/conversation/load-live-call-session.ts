/** Null when the load failed. Kept apart from the live call's hooks, so an intro doesn't load them. */
export function loadLiveCallSession() {
  return import("./live-call-session").catch(() => null);
}
