import { createHash } from "node:crypto";

export const hash = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");

export const caseRunKey = ({ caseId, run }: { caseId: string; run: number }) => `${caseId}-${run}`;

export function hashJson(value: unknown) {
  const canonical = JSON.stringify(value, (_key, nested: unknown) => {
    if (!nested || typeof nested !== "object" || Array.isArray(nested)) {
      return nested;
    }

    const entries = Object.entries(nested).toSorted(([left], [right]) =>
      left < right ? -1 : Number(left > right),
    );

    return Object.fromEntries(entries);
  });

  return hash(canonical);
}
