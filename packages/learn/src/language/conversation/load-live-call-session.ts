/**
 * The realtime client (the AI SDK's session and GPT-Live's events) loads for a call, when it
 * starts or as the learner reaches for Start, not with the intro. A load that failed is null. Kept
 * apart from the live call's hooks, so an intro (a checkpoint's first load) doesn't bring them.
 */
export function loadLiveCallSession() {
  return import("./live-call-session").catch(() => null);
}
