import { type TransactionClient } from "@zoonk/db";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { toAudioData } from "../../../library/language/_utils/language-audio";
import { type StoredChange } from "../contract";
import { contentFixVoiceSchema } from "../voice-schema";

type VoicedModel = "Sentence" | "Word";

type VoiceTarget = { id: string; model: VoicedModel; text: string };

function isVoiced(model: string): model is VoicedModel {
  return model === "Word" || model === "Sentence";
}

function targetOf(change: StoredChange): VoiceTarget | null {
  if (!isVoiced(change.model)) {
    return null;
  }

  if (change.op === "revoice") {
    return { id: change.id, model: change.model, text: change.text };
  }

  const textField = change.model === "Word" ? "word" : "sentence";
  const text = change.op === "set" && change.fields.find((field) => field.field === textField);

  return text && typeof text.after === "string"
    ? { id: change.id, model: change.model, text: text.after }
    : null;
}

async function loadVoice(db: TransactionClient, { id, model }: VoiceTarget) {
  const select = { organization: { select: { slug: true } }, targetLanguage: true } as const;

  return model === "Word"
    ? db.word.findUnique({ select, where: { id } })
    : db.sentence.findUnique({ select, where: { id } });
}

/**
 * The text a fix must voice before it can be approved: a word's or sentence's new text, or the
 * text it re-records. Null when it voices nothing or its language has no voice.
 */
export async function readVoiceTarget(
  db: TransactionClient,
  changes: readonly StoredChange[],
): Promise<(VoiceTarget & { orgSlug: string; targetLanguage: string }) | null> {
  const target = changes.map((change) => targetOf(change)).find((found) => found !== null);
  const row = target ? await loadVoice(db, target) : null;

  return target && row && isTTSSupportedLanguage(row.targetLanguage)
    ? { ...target, orgSlug: row.organization.slug, targetLanguage: row.targetLanguage }
    : null;
}

/** The clip a fix voiced for `text`. Approval waits for it, so a fix applying without one is a bug. */
export async function readFixClip(
  tx: TransactionClient,
  { fixId, text }: { fixId: string; text: string },
) {
  const fix = await tx.contentFix.findUniqueOrThrow({
    select: { voice: true },
    where: { id: fixId },
  });

  const voice = contentFixVoiceSchema.nullable().parse(fix.voice);

  if (voice?.status !== "voiced" || voice.text !== text) {
    throw new Error(`Content fix ${fixId} has no clip of its text`);
  }

  return toAudioData(voice);
}
