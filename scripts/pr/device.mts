import { mkdir } from "node:fs/promises";
import { basename, extname } from "node:path";
import { type CaptureItem, fileName, pathWithin, registerItems } from "./media.mts";
import { readCheckoutBuild, sha256File, sha256Text } from "./provenance.mts";

/**
 * Records after pictures taken on an emulator or a simulator, which no capture records: a sheet
 * over its page on Android, say, where a JVM render draws the sheet's window alone. Each is
 * stamped with the checkout's commit and its uncommitted changes to the app and `packages/` when
 * it was registered, so the gate holds it to an after's bar (committed, current, read). Nothing
 * measures its layout; its read does, and the check says so.
 */
export async function registerDevicePictures({
  device,
  files,
  platform,
  repository,
  to,
}: {
  device: string;
  files: string[];
  platform: "android" | "apple";
  repository: string;
  to: string;
}): Promise<CaptureItem[]> {
  const { current: _current, ...checkout } = await readCheckoutBuild({ app: platform, repository });
  const build = { ...checkout, id: checkout.commit };
  await mkdir(to, { recursive: true });

  const items = await Promise.all(
    files.map(async (file): Promise<CaptureItem> => ({
      build,
      device,
      file: pathWithin(to, file),
      kind: "shot",
      locale: "unknown",
      name: fileName(basename(file, extname(file))),
      platform,
      pointer: "coarse",
      scale: 1,
      scheme: "light",
      sha256: await sha256File(file),
      side: "after",
      steps: sha256Text(device),
      viewport: device,
    })),
  );

  await registerItems(to, items);
  return items;
}
