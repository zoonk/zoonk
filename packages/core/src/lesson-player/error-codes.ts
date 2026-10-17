/**
 * Stable error codes of the lesson endpoints, so the player (web or native) reacts to each one
 * (a calm wait, a sign-up or upgrade prompt, a fresh start) without parsing messages.
 * `SIGN_UP_REQUIRED` is a guest's new AI work once the day's budget all guests share is spent.
 */
export const LESSON_PLAYER_ERROR_CODES = {
  lessonSetAside: "LESSON_SET_ASIDE",
  noSpeech: "NO_SPEECH",
  plusRequired: "PLUS_REQUIRED",
  runEnded: "LESSON_RUN_ENDED",
  signUpRequired: "SIGN_UP_REQUIRED",
  slowDown: "SLOW_DOWN",
  usageLimitReached: "USAGE_LIMIT_REACHED",
} as const;
