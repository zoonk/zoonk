/**
 * The two skins over the same learning. Matches the `ExperienceMode` enum stored
 * on the learning profile; Focus is the default for everyone who never chose.
 */
export type ExperienceMode = "focus" | "fun";

const DEFAULT_EXPERIENCE_MODE: ExperienceMode = "focus";

function isExperienceMode(value: unknown): value is ExperienceMode {
  return value === "focus" || value === "fun";
}

/**
 * Signed-in learners keep their mode on the profile; guests keep it in a cookie.
 * The cookie is untrusted input, so anything unknown falls back to Focus.
 */
export function resolveExperienceMode({
  guestModeCookie,
  profileMode,
}: {
  guestModeCookie?: string | null;
  profileMode?: ExperienceMode | null;
}): ExperienceMode {
  if (profileMode) {
    return profileMode;
  }

  if (isExperienceMode(guestModeCookie)) {
    return guestModeCookie;
  }

  return DEFAULT_EXPERIENCE_MODE;
}
