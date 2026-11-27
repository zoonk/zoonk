/* oxlint-disable no-await-in-loop -- One pair at a time: a full-page shot decodes to tens of megabytes. */
import { existsSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { compareShots } from "./compare.mts";
import { type CaptureItem, type Retake } from "./media.mts";
import { sha256File } from "./provenance.mts";

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

async function readPicture(earlier: CaptureItem, folder: string) {
  const read = earlier.read ?? earlier.retakes?.read;
  const file = earlier.read ? earlier.file : earlier.retakes?.file;

  if (!read) {
    return;
  }

  const recordedHash = earlier.read ? earlier.sha256 : earlier.retakes?.sha256;
  const path = file === undefined ? undefined : resolve(folder, file);
  const actualHash = path && existsSync(path) ? await sha256File(path) : undefined;

  if (!file || !path || !actualHash || (recordedHash && recordedHash !== actualHash)) {
    return { read, sha256: recordedHash };
  }

  return { file: earlier.read ? `earlier/${file}` : file, path, read, sha256: actualHash };
}

async function carryRead({
  earlier,
  item,
  keep,
  picture,
  previousFolder,
}: {
  earlier: CaptureItem;
  item: CaptureItem;
  keep: string;
  picture: string;
  previousFolder: string;
}): Promise<CaptureItem> {
  const kept = await readPicture(earlier, previousFolder);

  if (!kept) {
    return item;
  }

  const { file, path, read, sha256 } = kept;

  if (
    sha256 &&
    (sha256 === item.sha256 || (item.kind === "shot" && path && (await samePixels(path, picture))))
  ) {
    return { ...item, read: { ...read, carriedFrom: read.carriedFrom ?? sha256 } };
  }

  if (!file || !path) {
    return { ...item, retakes: { read } };
  }

  const to = resolve(keep, file);

  if (path !== to) {
    await mkdir(dirname(to), { recursive: true });
    await copyFile(path, to);
  }

  const retakes: Retake = { file, read, sha256 };
  return { ...item, retakes };
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

    carried.push(
      earlier ? await carryRead({ earlier, item, keep, picture: now(item), previousFolder }) : item,
    );
  }

  return carried;
}
