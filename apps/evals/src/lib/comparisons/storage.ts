import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { hash } from "./identity";
import {
  type Comparison,
  type Manifest,
  adjudicationSchema,
  attemptSchema,
  checkSchema,
  digest,
  identifier,
  manifestSchema,
  verificationAttemptSchema,
} from "./schemas";
import { compactSnapshot, expandSnapshot } from "./snapshot";
import type z from "zod";

export function directory(taskId: string, id: string) {
  return path.join(
    process.cwd(),
    "eval-results",
    "comparisons",
    identifier.parse(taskId),
    identifier.parse(id),
  );
}
function absent(entry: unknown) {
  return entry instanceof Error && "code" in entry && entry.code === "ENOENT";
}
export async function readOptional<T>(file: string, schema: z.ZodType<T>): Promise<T | null> {
  let raw: string;

  try {
    raw = await fs.readFile(file, "utf8");
  } catch (error) {
    if (absent(error)) {
      return null;
    }

    throw error;
  }

  return parseRecord(file, raw, schema);
}

async function parseRecord<T>(file: string, raw: string, schema: z.ZodType<T>) {
  const value: unknown = JSON.parse(raw);

  if (
    value &&
    typeof value === "object" &&
    "snapshotVersion" in value &&
    value.snapshotVersion === 2 &&
    "data" in value
  ) {
    const verification = path.basename(path.dirname(file)) === "verifications";
    const root = verification ? path.dirname(path.dirname(file)) : path.dirname(file);

    return schema.parse(
      await expandSnapshot(value.data, verification, (key) => readBlob(root, key)),
    );
  }

  return schema.parse(value);
}
export async function writeBytes(file: string, bytes: string | Buffer, replace = false) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(temp, bytes, { flag: "wx" });

  try {
    if (replace) {
      await fs.rename(temp, file);
      return;
    }

    try {
      await fs.link(temp, file);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) {
        throw error;
      }

      const existing = await fs.readFile(file);

      if (!existing.equals(Buffer.from(bytes))) {
        throw error;
      }
    }
  } finally {
    await fs.rm(temp, { force: true });
  }
}
export async function writeRecord<T>(
  file: string,
  schema: z.ZodType<T>,
  value: unknown,
  replace = false,
) {
  const parsed = schema.parse(value);
  const verification = path.basename(path.dirname(file)) === "verifications";
  let stored: unknown = parsed;

  if (verification || ["selection.json", "manifest.json"].includes(path.basename(file))) {
    const root = verification ? path.dirname(path.dirname(file)) : path.dirname(file);
    const { blobs, snapshot } = compactSnapshot(parsed, verification);

    await Promise.all(
      [...blobs].map(([key, bytes]) => writeBytes(path.join(root, "outputs", key), bytes)),
    );

    stored = snapshot;
  }

  await writeBytes(file, `${JSON.stringify(stored, null, 2)}\n`, replace);
  return parsed;
}
async function entries(dir: string) {
  try {
    return await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (absent(error)) {
      return [];
    }

    throw error;
  }
}
export async function listComparisons(taskId: string) {
  const root = path.dirname(directory(taskId, "index"));
  const folders = await entries(root);
  const dirs = folders.filter((folder) => folder.isDirectory());

  const sealed = await Promise.all(
    dirs.map(async (folder) => {
      const files = await entries(path.join(root, folder.name));
      return files.some((file) => file.name === "manifest.json") ? folder.name : null;
    }),
  );

  return sealed.filter((value) => value !== null).toSorted();
}
async function records<T>(dir: string, schema: z.ZodType<T>) {
  const children = await entries(dir);

  const files = children
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .toSorted();

  return Promise.all(
    files.map(async (file) =>
      parseRecord(path.join(dir, file), await fs.readFile(path.join(dir, file), "utf8"), schema),
    ),
  );
}
export async function readBlob(dir: string, key: string) {
  const bytes = await fs.readFile(path.join(dir, "outputs", digest.parse(key)));

  if (hash(bytes) !== key) {
    throw new Error("Compared output no longer matches its sealed digest.");
  }

  return bytes;
}

export async function readOutputs(
  dir: string,
  { controls, runsCompared }: Pick<Manifest, "controls" | "runsCompared">,
) {
  const formats = new Map(
    runsCompared.flatMap((run) =>
      [run.challenger, run.incumbent].flatMap((slot) =>
        slot ? [[slot.hash, slot.mediaType] as const] : [],
      ),
    ),
  );

  controls.pairs.forEach(({ clean, flawed }) => {
    for (const item of [clean, flawed]) {
      if (typeof item !== "string") {
        formats.set(item.image, "image/webp");
      }
    }
  });

  return Object.fromEntries(
    await Promise.all(
      [...formats].map(async ([key, mediaType]) => {
        const bytes = await readBlob(dir, key);
        return [key, mediaType ? bytes : bytes.toString("utf8")] as const;
      }),
    ),
  );
}

export async function loadComparison(taskId: string, id: string): Promise<Comparison> {
  const dir = directory(taskId, id);
  const manifest = await readOptional(path.join(dir, "manifest.json"), manifestSchema);

  if (!manifest || manifest.taskId !== taskId || manifest.id !== id) {
    throw new Error("Comparison has no matching sealed manifest.");
  }

  const [outputs, attempts, checks, verifications, adjudications] = await Promise.all([
    readOutputs(dir, manifest),
    records(path.join(dir, "verdicts"), attemptSchema),
    records(path.join(dir, "checks"), checkSchema),
    records(path.join(dir, "verifications"), verificationAttemptSchema),
    records(path.join(dir, "adjudications"), adjudicationSchema),
  ]);

  return { adjudications, attempts, checks, manifest, outputs, verifications };
}
