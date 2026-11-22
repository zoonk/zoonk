import { type WritingDraft } from "@zoonk/core/exams/essays/writing-contract";
import { deviceStorage } from "../_utils/device-storage";

/**
 * What this device typed, with the admission it was typed under and the saved draft's revision it
 * was typed over. Null admission: typed on a block the server hadn't admitted yet.
 */
export type Kept = { admissionId: string | null; base: number; text: string };

/** A saved draft on the server, as a conflict or a save's answer returns it. */
export type ServerDraft = { revision: number; text: string };

/** Where the server's copy stands as far as this editor knows: the base of its next save. */
export type DraftPosition = { admissionId: string | null; revision: number; text: string };

export function keptDraftKey(blockId: string): string {
  return `writing:${blockId}`;
}

export function parseKeptDraft(raw: string | null): Kept | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("base" in parsed) ||
      !("text" in parsed) ||
      typeof parsed.base !== "number" ||
      typeof parsed.text !== "string"
    ) {
      return null;
    }

    const admissionId =
      "admissionId" in parsed && typeof parsed.admissionId === "string" ? parsed.admissionId : null;

    return { admissionId, base: parsed.base, text: parsed.text };
  } catch {
    return null;
  }
}

export function keepDraftText(blockId: string, kept: Kept) {
  const raw = JSON.stringify({ ...kept, version: crypto.randomUUID() });
  return deviceStorage.set(keptDraftKey(blockId), raw) ? raw : null;
}

/**
 * What the editor opens with. This device's copy is offered only for the admission the learner is
 * writing under now, never for an earlier one (a rewrite, another device's new start), and an edit
 * typed over an older revision than the server's isn't chosen by number: the learner is asked. A
 * cleared field is an edit like any other.
 */
export function openDraft({
  admissionId,
  kept,
  saved,
}: {
  admissionId: string | null;
  kept: Kept | null;
  saved: WritingDraft | null;
}): { conflict: ServerDraft | null; position: DraftPosition; text: string } {
  const position = saved
    ? { admissionId: saved.admissionId, revision: saved.revision, text: saved.text }
    : { admissionId, revision: 0, text: "" };

  if (!kept || kept.admissionId !== admissionId) {
    return { conflict: null, position, text: position.text };
  }

  if (!saved || kept.base >= saved.revision || kept.text === saved.text) {
    return { conflict: null, position, text: kept.text };
  }

  // Until the learner answers, edits here stay typed over the revision they were typed over.
  return {
    conflict: { revision: saved.revision, text: saved.text },
    position: { ...position, revision: kept.base },
    text: kept.text,
  };
}

/**
 * A save of `sent` came back as `revision`: the server holds it now. Anything typed since stays
 * this device's copy, over the new revision, to be saved next; nothing typed is kept when it's all
 * on the server.
 */
export function acknowledgeSave({
  admissionId,
  latest,
  revision,
  sent,
}: {
  admissionId: string;
  latest: string;
  revision: number;
  sent: string;
}): { kept: Kept | null; position: DraftPosition } {
  return {
    kept: latest === sent ? null : { admissionId, base: revision, text: latest },
    position: { admissionId, revision, text: sent },
  };
}
