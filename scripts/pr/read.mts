import { type Finding, type Read, readManifest, readOf, writeManifest } from "./media.mts";
import { sha256Text } from "./provenance.mts";
import { readablePictures } from "./tiles.mts";

export type ReadFinding = { files: string[]; finding: Finding };

const FINDING_ID_LENGTH = 8;

function isText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** One id per finding, shared by every picture it names, so resolving it resolves them all. */
function toReadFinding(entry: unknown): ReadFinding | undefined {
  if (typeof entry !== "object" || entry === null) {
    return undefined;
  }

  const field = (key: string): unknown => Reflect.get(entry, key);

  const [before, crop, file, measurement, misleads, rule, text] = [
    "before",
    "crop",
    "file",
    "measurement",
    "misleads",
    "rule",
    "text",
  ].map((key) => field(key));

  const listed: unknown[] = Array.isArray(file) ? file : [file];
  const files = listed.filter((name) => isText(name));
  const sorted = typeof before === "boolean" && typeof misleads === "boolean" && isText(rule);

  if (!isText(text) || !sorted || files.length === 0 || files.length !== listed.length) {
    return undefined;
  }

  const extra = { ...(isText(measurement) && { measurement }), ...(isText(crop) && { crop }) };
  const id = sha256Text(JSON.stringify([files, text])).slice(0, FINDING_ID_LENGTH);
  return { files, finding: { before, id, misleads, rule, state: "open", text, ...extra } };
}

/**
 * The findings a reader wrote, or nothing when any entry isn't
 * `{ "file", "text", "rule", "before", "misleads" }`.
 */
export function parseFindings(parsed: unknown): ReadFinding[] | undefined {
  const entries = Array.isArray(parsed) ? parsed.map((entry) => toReadFinding(entry)) : [undefined];
  const valid = entries.filter((entry) => entry !== undefined);
  return valid.length === entries.length ? valid : undefined;
}

/**
 * Records a read on every after picture under `root` that has none, each with the findings that
 * name it, matched by the picture the reader named and never by its bytes.
 */
export async function recordReads({
  by,
  entries,
  root,
}: {
  by: string;
  entries: ReadFinding[];
  root: string;
}): Promise<{ already: number; read: number }> {
  if (!by.trim()) {
    throw new Error("Say who read the pictures with --by.");
  }

  const pictures = await readablePictures(root);
  const unread = pictures.filter(({ item }) => !readOf(item));
  const known = new Set(unread.map(({ id }) => id));
  const strays = entries.flatMap(({ files }) => files.filter((file) => !known.has(file)));

  if (strays.length > 0) {
    throw new Error(
      `These findings name no unread after picture under ${root}: ${strays.join(", ")}`,
    );
  }

  const at = new Date().toISOString();

  await Promise.all(
    [...Map.groupBy(unread, (picture) => picture.folder)].map(async ([folder, list]) => {
      const named = new Map(list.map((picture) => [picture.item.file, picture.id]));
      const items = (await readManifest(folder)) ?? [];

      const updated = items.map((item) => {
        const id = named.get(item.file);

        if (id === undefined) {
          return item;
        }

        // A finding leaves a record only through resolve, so a read replacing one keeps it, and a
        // read of a retake keeps the findings of the read it retakes. One the reader reports again
        // is open again, whatever closed it.
        const retakes = "retakes" in item ? item.retakes : undefined;
        const unnamed = "read" in item ? (item.read?.findings ?? []) : [];
        const kept = [...(retakes?.read.findings ?? []), ...unnamed];

        const added = entries.flatMap(({ files, finding }) =>
          files.includes(id) ? [finding] : [],
        );

        const findings = [...new Map([...kept, ...added].map((one) => [one.id, one])).values()];
        const read: Read = { at, by, findings, ...(retakes && { retake: true }) };
        return { ...item, read };
      });

      await writeManifest(folder, updated);
    }),
  );

  return { already: pictures.length - unread.length, read: unread.length };
}
