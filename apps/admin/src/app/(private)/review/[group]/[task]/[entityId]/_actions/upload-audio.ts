"use server";

import { isAdmin } from "@/lib/admin-guard";
import { uploadAudio } from "@zoonk/core/audio/upload";
import { prisma } from "@zoonk/db";
import { DEFAULT_AUDIO_ACCEPTED_TYPES, DEFAULT_AUDIO_MAX_SIZE } from "@zoonk/utils/upload";
import { revalidatePath } from "next/cache";

/**
 * Validates that the file from FormData is a supported audio format
 * within the size limit.
 */
function validateAudioFile(formData: FormData): { file: File } | { error: string } {
  const file = formData.get("file");

  if (!(file && file instanceof File)) {
    return { error: "No file provided" };
  }

  if (!DEFAULT_AUDIO_ACCEPTED_TYPES.includes(file.type)) {
    return { error: "Invalid file type. Please upload a WAV, OGG, MP3, or Opus audio file." };
  }

  if (file.size > DEFAULT_AUDIO_MAX_SIZE) {
    return { error: "File is too large. Maximum size is 10MB." };
  }

  return { file };
}

/**
 * Shared pipeline for uploading replacement audio: validates admin access,
 * parses the entity ID, validates the file, uploads to Vercel Blob,
 * then delegates the DB update to the caller-provided function.
 */
async function uploadEntityAudio({
  entityId,
  entityType,
  formData,
  updateEntity,
}: {
  entityId: string;
  entityType: string;
  formData: FormData;
  updateEntity: (audioUrl: string, id: string) => Promise<unknown>;
}): Promise<{ error: string | null }> {
  if (!(await isAdmin())) {
    return { error: "Unauthorized" };
  }

  const validation = validateAudioFile(formData);

  if ("error" in validation) {
    return { error: validation.error };
  }

  const buffer = new Uint8Array(await validation.file.arrayBuffer());
  const extension = validation.file.name.split(".").pop() ?? "wav";

  const { data: audioUrl, error: uploadError } = await uploadAudio({
    audio: buffer,
    fileName: `audio/admin-review/${entityType}-${entityId}.${extension}`,
  });

  if (uploadError) {
    return { error: "Failed to upload audio. Please try again." };
  }

  await updateEntity(audioUrl, entityId);

  revalidatePath("/review");
  return { error: null };
}

/**
 * Uploads an audio file to replace a flagged word's TTS audio.
 */
export async function uploadWordAudioAction(
  params: { entityId: string },
  formData: FormData,
): Promise<{ error: string | null }> {
  return uploadEntityAudio({
    entityId: params.entityId,
    entityType: "word",
    formData,
    updateEntity: (audioUrl, id) => prisma.word.update({ data: { audioUrl }, where: { id } }),
  });
}

/**
 * Uploads an audio file to replace a flagged sentence's TTS audio.
 */
export async function uploadSentenceAudioAction(
  params: { entityId: string },
  formData: FormData,
): Promise<{ error: string | null }> {
  return uploadEntityAudio({
    entityId: params.entityId,
    entityType: "sentence",
    formData,
    updateEntity: (audioUrl, id) => prisma.sentence.update({ data: { audioUrl }, where: { id } }),
  });
}
