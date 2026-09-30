import { hasPrivateSources } from "@zoonk/core/library/sources/visibility";

/** True when research reads the learner's private uploads, so its result stays theirs. */
export async function hasPrivateUploadsStep(sourceIds: string[]): Promise<boolean> {
  "use step";

  return sourceIds.length > 0 && (await hasPrivateSources(sourceIds));
}
