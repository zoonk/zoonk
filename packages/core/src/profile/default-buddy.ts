import { type BuddyGlasses, type BuddyKind, type UserLearningProfile } from "@zoonk/db";

export type ResolvedBuddy = {
  glasses: BuddyGlasses;
  kind: BuddyKind;
  name: string | null;
  /** Whether the learner saved a choice rather than using the default. */
  picked: boolean;
};

/** Every learner has Zu until they choose a buddy; reading the default never saves a choice. */
export const DEFAULT_BUDDY: ResolvedBuddy = {
  glasses: "round",
  kind: "zu",
  name: null,
  picked: false,
};

export function resolveProfileBuddy(
  profile: Pick<UserLearningProfile, "buddyGlasses" | "buddyKind" | "buddyName"> | null,
): ResolvedBuddy {
  if (!profile?.buddyKind) {
    return DEFAULT_BUDDY;
  }

  return {
    glasses: profile.buddyGlasses,
    kind: profile.buddyKind,
    name: profile.buddyName,
    picked: true,
  };
}
