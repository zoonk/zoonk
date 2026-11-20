import { deviceStorage } from "../_utils/device-storage";

/** What this device typed, with the saved draft's revision it was typed over. */
export type Kept = { base: number; text: string };

export function keptDraftKey(blockId: string): string {
  return `writing:${blockId}`;
}

export function parseKeptDraft(raw: string | null): Kept | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    return typeof parsed === "object" &&
      parsed !== null &&
      "base" in parsed &&
      "text" in parsed &&
      typeof parsed.base === "number" &&
      typeof parsed.text === "string"
      ? { base: parsed.base, text: parsed.text }
      : null;
  } catch {
    return null;
  }
}

export function keepDraftText(blockId: string, kept: Kept) {
  deviceStorage.set(keptDraftKey(blockId), JSON.stringify(kept));
}

/**
 * This device's text wins only when it was typed over the draft the server still has: a newer
 * draft saved on another device is the one to continue.
 */
export function chooseDraftText({
  kept,
  saved,
}: {
  kept: Kept | null;
  saved: { revision: number; text: string } | null;
}): string {
  const revision = saved?.revision ?? 0;
  return kept && kept.text.trim() && kept.base >= revision ? kept.text : (saved?.text ?? "");
}
