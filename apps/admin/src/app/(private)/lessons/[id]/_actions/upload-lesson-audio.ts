"use server";

import { assertAdmin } from "@/lib/admin-guard";
import { uploadAudio } from "@zoonk/core/audio/upload";
import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidatePath } from "next/cache";

const MAX_AUDIO_UPLOAD_MEGABYTES = 5;
const MAX_AUDIO_UPLOAD_BYTES = MAX_AUDIO_UPLOAD_MEGABYTES * 1024 * 1024;

const AUDIO_FILE_EXTENSIONS = {
  "audio/m4a": "m4a",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/webm": "webm",
  "audio/x-m4a": "m4a",
  "audio/x-wav": "wav",
} as const;

type AudioResourceKind = "alphabet" | "sentence" | "word";

export type UploadLessonAudioState = {
  error: string | null;
  status: "idle" | "error" | "success";
  submissionId: number;
};

/**
 * Rejects unsupported media before upload so the player never receives a URL
 * whose file extension or browser decoding contract is ambiguous.
 */
function getAudioFileExtension(file: File): string | null {
  return (
    Object.entries(AUDIO_FILE_EXTENSIONS).find(([mimeType]) => mimeType === file.type)?.[1] ?? null
  );
}

/**
 * Keeps alphabet Step, Word, and Sentence updates behind one validated admin
 * action while each Prisma mutation still targets the real storage model.
 */
async function updateAudioResource({
  audioUrl,
  resourceId,
  resourceKind,
}: {
  audioUrl: string;
  resourceId: string;
  resourceKind: AudioResourceKind;
}): Promise<void> {
  if (resourceKind === "alphabet") {
    const step = await prisma.step.findUniqueOrThrow({ where: { id: resourceId } });
    const content = parseStepContent("alphabet", step.content);

    await prisma.step.update({
      data: { content: { ...content, audioUrl } },
      where: { id: resourceId },
    });

    return;
  }

  if (resourceKind === "word") {
    await prisma.word.update({ data: { audioUrl }, where: { id: resourceId } });
    return;
  }

  await prisma.sentence.update({ data: { audioUrl }, where: { id: resourceId } });
}

/**
 * Converts the trusted form value into the lesson audio resource kinds that
 * the admin detail page can display.
 */
function isAudioResourceKind(value: string | null): value is AudioResourceKind {
  return value === "alphabet" || value === "sentence" || value === "word";
}

/**
 * Uploads one admin-selected clip and attaches it to the missing symbol, word,
 * or sentence resource so every lesson using that resource benefits immediately.
 */
export async function uploadLessonAudioAction(
  previousState: UploadLessonAudioState,
  formData: FormData,
): Promise<UploadLessonAudioState> {
  await assertAdmin();

  const submissionId = previousState.submissionId + 1;
  const lessonId = parseFormField(formData, "lessonId");
  const resourceId = parseFormField(formData, "resourceId");
  const resourceKind = parseFormField(formData, "resourceKind");
  const audioFile = formData.get("audio");

  if (!(isUuid(lessonId) && isUuid(resourceId) && isAudioResourceKind(resourceKind))) {
    return { error: "Invalid audio resource.", status: "error", submissionId };
  }

  if (!(audioFile instanceof File) || audioFile.size === 0) {
    return { error: "Choose an audio file.", status: "error", submissionId };
  }

  const extension = getAudioFileExtension(audioFile);

  if (!extension) {
    return { error: "Upload an MP3, M4A, WAV, OGG, or WebM file.", status: "error", submissionId };
  }

  if (audioFile.size > MAX_AUDIO_UPLOAD_BYTES) {
    return { error: "Audio files must be 5 MB or smaller.", status: "error", submissionId };
  }

  const { data: audioUrl, error: uploadError } = await uploadAudio({
    audio: new Uint8Array(await audioFile.arrayBuffer()),
    fileName: `audio/admin/${resourceKind}/${resourceId}.${extension}`,
  });

  if (uploadError || !audioUrl) {
    return {
      error: "Could not upload this audio. Please try again.",
      status: "error",
      submissionId,
    };
  }

  const { error: updateError } = await safeAsync(() =>
    updateAudioResource({ audioUrl, resourceId, resourceKind }),
  );

  if (updateError) {
    return { error: "Could not save this audio. Please try again.", status: "error", submissionId };
  }

  revalidatePath("/lessons");
  revalidatePath(`/lessons/${lessonId}`);

  return { error: null, status: "success", submissionId };
}
