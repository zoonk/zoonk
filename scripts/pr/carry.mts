/* oxlint-disable no-await-in-loop -- One pair at a time: a full-page shot decodes to tens of megabytes. */
import { join } from "node:path";
import { compareShots } from "./compare.mts";
import { type CaptureItem } from "./media.mts";

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
 * A picture captured again with the same pixels shows what was read, so its read and its
 * findings' states carry over; anything else needs a new read.
 */
export async function carryReads({
  folder,
  items,
  previous,
  previousFolder,
}: {
  folder: string;
  items: CaptureItem[];
  previous: CaptureItem[];
  previousFolder: string;
}): Promise<CaptureItem[]> {
  const read = new Map(
    previous.flatMap((item) => (item.read ? [[configuration(item), item]] : [])),
  );

  const carried: CaptureItem[] = [];

  for (const item of items) {
    const earlier = read.get(configuration(item));

    const same =
      earlier?.read &&
      (earlier.sha256 === item.sha256 ||
        (item.kind === "shot" &&
          (await samePixels(join(previousFolder, earlier.file), join(folder, item.file)))));

    carried.push(
      same && earlier.read
        ? {
            ...item,
            read: { ...earlier.read, carriedFrom: earlier.read.carriedFrom ?? earlier.sha256 },
          }
        : item,
    );
  }

  return carried;
}
