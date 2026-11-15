import { type ManifestItem, deviceLine, isRecorded } from "./media.mts";
import { type Problem } from "./report.mts";

/**
 * A picture with a device record goes under the device heading and only there, its caption saying
 * what was verified; anything else under it isn't a device picture. A forged record can only put
 * a picture where the reader sees nothing measured it.
 */
export function placementProblems({
  caption,
  items,
  picture,
}: {
  caption?: string;
  items: ManifestItem[];
  picture: string;
}): { line?: string; problems: Problem[] } {
  const [line] = items.flatMap((item) =>
    item.side === "after" && isRecorded(item) && item.device ? [deviceLine(item)] : [],
  );

  if (caption === undefined) {
    return { problems: line ? [{ kind: "device-elsewhere", picture }] : [] };
  }

  if (!line) {
    return { problems: items.length > 0 ? [{ kind: "not-device", picture }] : [] };
  }

  return {
    line,
    problems: caption.includes(line) ? [] : [{ detail: line, kind: "caption", picture }],
  };
}
