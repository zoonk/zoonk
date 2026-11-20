import { hash } from "./identity";

function blobFormat(key: string, value: unknown) {
  if (["clean", "flawed", "A", "B", "expectations"].includes(key) && typeof value === "string") {
    return "text";
  }

  if (key === "input" || (key === "criteria" && Array.isArray(value))) {
    return "json";
  }

  return null;
}

export function compactSnapshot(record: unknown, verification: boolean) {
  const blobs = new Map<string, string>();

  const data: unknown = JSON.parse(
    JSON.stringify(record, (key, value: unknown) => {
      if (verification && key === "packet" && typeof value === "string") {
        const entries: unknown = JSON.parse(value);

        if (JSON.stringify(entries) !== value) {
          throw new Error("Cannot compact a noncanonical verification packet.");
        }

        return entries;
      }

      const format = blobFormat(key, value);

      if (!format) {
        return value;
      }

      const bytes = format === "text" ? String(value) : JSON.stringify(value);
      const digest = hash(bytes);
      blobs.set(digest, bytes);
      return { blob: digest, format };
    }),
  );

  return { blobs, snapshot: { data, snapshotVersion: 2 } };
}

const isReference = (value: unknown): value is { blob: string; format: "text" | "json" } =>
  typeof value === "object" &&
  value !== null &&
  "blob" in value &&
  typeof value.blob === "string" &&
  "format" in value &&
  (value.format === "text" || value.format === "json");

export async function expandSnapshot(
  data: unknown,
  verification: boolean,
  read: (digest: string) => Promise<Buffer>,
) {
  const blobs = new Map<string, Promise<Buffer>>();

  JSON.stringify(data, (_key, value: unknown) => {
    if (isReference(value) && !blobs.has(value.blob)) {
      blobs.set(value.blob, read(value.blob));
    }

    return value;
  });

  const bytes = new Map(
    await Promise.all(
      [...blobs].map(async ([digest, pending]) => {
        const buffer = await pending;
        return [digest, buffer.toString("utf8")] as const;
      }),
    ),
  );
  // A reviver restores leaves first, keeping the original order of keys in verifier packets.
  return JSON.parse(JSON.stringify(data), (key, value: unknown) => {
    if (isReference(value)) {
      const content = bytes.get(value.blob);

      if (content === undefined) {
        throw new Error("Missing sealed blob.");
      }

      return value.format === "text" ? content : (JSON.parse(content) as unknown);
    }

    return verification && key === "packet" ? JSON.stringify(value) : value;
  }) as unknown;
}
