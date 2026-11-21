import path from "node:path";
import { type Manifest, digest, identifier, manifestSchema } from "@/lib/comparisons/schemas";
import { directory, readBlob, readOptional } from "@/lib/comparisons/storage";

function sealedImages(manifest: Manifest): Set<string> {
  const compared = manifest.runsCompared.flatMap((run) =>
    [run.challenger, run.incumbent].flatMap((slot) => (slot?.mediaType ? [slot.hash] : [])),
  );

  const shown = manifest.packets.flatMap(({ packet }) =>
    packet.pairs.flatMap((pair) =>
      [pair.A, pair.B].flatMap((output) =>
        output !== null && typeof output !== "string" ? [output.image] : [],
      ),
    ),
  );

  return new Set([...compared, ...shown]);
}

/** A picture's bytes, only when the comparison sealed it as a compared output or a packet's picture. */
export async function comparisonImage({
  hash,
  id,
  taskId,
}: {
  hash: string;
  id: string;
  taskId: string;
}): Promise<Buffer | null> {
  if (
    !identifier.safeParse(taskId).success ||
    !identifier.safeParse(id).success ||
    !digest.safeParse(hash).success
  ) {
    return null;
  }

  const dir = directory(taskId, id);
  const manifest = await readOptional(path.join(dir, "manifest.json"), manifestSchema);

  if (manifest?.taskId !== taskId || manifest.id !== id || !sealedImages(manifest).has(hash)) {
    return null;
  }

  return readBlob(dir, hash);
}
