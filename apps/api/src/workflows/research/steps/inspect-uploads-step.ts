import { hasPrivateSources } from "@zoonk/core/library/sources/visibility";

export async function hasPrivateUploadsStep(sourceIds: string[]): Promise<boolean> {
  "use step";

  return sourceIds.length > 0 && (await hasPrivateSources(sourceIds));
}
