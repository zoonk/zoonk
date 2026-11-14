import "server-only";
import { prisma } from "@zoonk/db";
import { generateLanguageAudio } from "../../audio/generate-language-audio";
import { readVoiceTarget } from "./_utils/vocabulary-voice";
import { contentFixChangesSchema } from "./contract";
import { type ContentFixVoice } from "./voice-schema";

/** What a proposed fix still waiting for its clip must voice; undefined when it waits for nothing. */
async function readOwedVoice(fixId: string) {
  const fix = await prisma.contentFix.findFirst({
    select: { changes: true },
    where: { id: fixId, status: "proposed", voiceOwedAt: { not: null } },
  });

  return fix ? readVoiceTarget(prisma, contentFixChangesSchema.parse(fix.changes)) : undefined;
}

function saveVoice({ fixId, voice }: { fixId: string; voice: ContentFixVoice }) {
  return prisma.contentFix.updateMany({
    data: { voice, ...(voice.status === "voiced" ? { voiceOwedAt: null } : {}) },
    where: { id: fixId, voiceOwedAt: { not: null } },
  });
}

/** The fix stays waiting, so it can't be approved, and Admin says to propose it again. */
export async function failContentFixVoice({ fixId }: { fixId: string }): Promise<void> {
  await saveVoice({ fixId, voice: { status: "failed" } });
}

/**
 * Internal, for the follow-up a word or sentence fix owes when it's proposed: records the clip of
 * its text on the fix, so the approver hears it and approving writes both. A failed voice throws,
 * so the step retries; a row deleted since can't be voiced at all.
 */
export async function voiceContentFix({ fixId }: { fixId: string }): Promise<void> {
  const target = await readOwedVoice(fixId);

  if (target === undefined) {
    return;
  }

  if (target === null) {
    await failContentFixVoice({ fixId });
    return;
  }

  const { data, error } = await generateLanguageAudio({
    language: target.targetLanguage,
    orgSlug: target.orgSlug,
    text: target.text,
  });

  if (error) {
    throw error;
  }

  await saveVoice({
    fixId,
    voice: { provenance: data.provenance, status: "voiced", text: target.text, url: data.url },
  });
}
