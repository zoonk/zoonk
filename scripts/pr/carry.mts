/* oxlint-disable no-await-in-loop -- One pair at a time: a full-page shot decodes to tens of megabytes. */
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { compareShots } from "./compare.mts";
import { type CaptureItem, type Retake } from "./media.mts";

/** A read holds only for the same state, drawn at the same size, scale, language and scheme. */
function configuration(item: CaptureItem): string {
  return [
    item.platform,
    item.kind === "shot" ? item.name : "video",
    item.scenario ?? "",
    item.viewport,
    item.scale,
    item.locale,
    item.scheme,
  ].join("\n");
}

async function samePixels(earlier: string, now: string): Promise<boolean> {
  const { box } = await compareShots(earlier, now);
  return box === undefined;
}

/**
 * What a retake of `earlier` checks its fixes against: `earlier`'s read and picture, or, when
 * nobody read `earlier`, the read it retook. The picture is copied into `keep`.
 */
async function retakeOf({
  earlier,
  keep,
  previousFolder,
}: {
  earlier: CaptureItem;
  keep: string;
  previousFolder: string;
}): Promise<Retake | undefined> {
  const retake = earlier.read
    ? { file: `earlier/${earlier.file}`, read: earlier.read }
    : earlier.retakes;

  if (retake) {
    await mkdir(dirname(join(keep, retake.file)), { recursive: true });
    const from = join(previousFolder, earlier.read ? earlier.file : retake.file);
    await copyFile(from, join(keep, retake.file));
  }

  return retake;
}

/**
 * A picture captured again with the same pixels shows what was read, so its read and its
 * findings' states carry over. One whose pixels changed keeps the read it retakes, with that
 * picture copied into `keep` (`folder` unless given), so its new read checks only the fixes. Each
 * new picture is its file in `folder`, or where `now` says.
 */
export async function carryReads({
  folder,
  items,
  keep = folder,
  now = (item) => join(folder, item.file),
  previous,
  previousFolder,
}: {
  folder: string;
  items: CaptureItem[];
  keep?: string;
  now?: (item: CaptureItem) => string;
  previous: CaptureItem[];
  previousFolder: string;
}): Promise<CaptureItem[]> {
  const earlierOf = new Map(
    previous.flatMap((item) => (item.read || item.retakes ? [[configuration(item), item]] : [])),
  );

  const carried: CaptureItem[] = [];

  for (const item of items) {
    const earlier = earlierOf.get(configuration(item));

    const same =
      earlier?.read &&
      (earlier.sha256 === item.sha256 ||
        (item.kind === "shot" &&
          (await samePixels(join(previousFolder, earlier.file), now(item)))));

    if (same && earlier.read) {
      const carriedFrom = earlier.read.carriedFrom ?? earlier.sha256;
      carried.push({ ...item, read: { ...earlier.read, carriedFrom } });
    } else {
      const retakes = earlier && (await retakeOf({ earlier, keep, previousFolder }));
      carried.push(retakes ? { ...item, retakes } : item);
    }
  }

  return carried;
}
