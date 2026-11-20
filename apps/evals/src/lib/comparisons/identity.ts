import { createHash } from "node:crypto";

export const hash = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");

/** A chained task records each step's prompt joined by `---`; later steps include earlier outputs, so only the first step's prompt identifies the input. */
export const promptHash = (userPrompt: string) =>
  hash(userPrompt.split("\n---\n")[0] ?? userPrompt);
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
