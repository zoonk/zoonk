import { type UserLearningProfile } from "@zoonk/db";

type DepthProfile = Pick<
  UserLearningProfile,
  "deeperByDefault" | "memoryAsksDeeper" | "memoryEnabled"
> | null;

/**
 * Whether lessons open the "Go deeper" version first: the learner's own choice wins; without one,
 * memory decides while it's on. `fromMemory` says it's on only because memory says so.
 */
export function resolveDeeperByDefault(profile: DepthProfile) {
  const fromMemory = Boolean(profile?.memoryEnabled && profile.memoryAsksDeeper);
  const choice = profile?.deeperByDefault ?? null;

  return { deeperByDefault: choice ?? fromMemory, deeperFromMemory: choice === null && fromMemory };
}
