import "server-only";
import { generateLanguageAudio } from "@zoonk/ai/tasks/audio";
import { type MediaAsset, prisma } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { getPrivateAudioFolder } from "@zoonk/utils/user-blobs";
import { createOrFindByIdentity, toProvenanceData } from "../../library/_utils/library-rows";
import { uploadAudio } from "../upload-audio";

type SpeechClipAnalytics = Omit<
  NonNullable<Parameters<typeof generateLanguageAudio>[0]["analytics"]>,
  "contentScope"
>;

const AUDIO_MIME_TYPE = "audio/mpeg";

const voicing = new Map<string, Promise<MediaAsset | null>>();

export function findSpeechClip(reuseKey: string): Promise<MediaAsset | null> {
  return prisma.mediaAsset.findUnique({ where: { reuseKey } });
}

function getUploadTarget({ language, ownerId }: { language: string; ownerId: string | null }) {
  return ownerId
    ? { access: "private" as const, fileName: `${getPrivateAudioFolder(ownerId)}${language}` }
    : { access: "public" as const, fileName: `library/audio/${language}` };
}

async function voiceClip({
  analytics,
  language,
  ownerId,
  reuseKey,
  text,
}: {
  language: string;
  ownerId: string | null;
  reuseKey: string;
  text: string;
  analytics?: SpeechClipAnalytics;
}): Promise<MediaAsset | null> {
  const stored = await findSpeechClip(reuseKey);

  if (stored) {
    return stored;
  }

  const { data: voiced, error } = await generateLanguageAudio({
    analytics: { ...analytics, contentScope: ownerId ? "personal" : "shared" },
    language,
    text,
  });

  if (error) {
    logError("Error voicing a speech clip:", error);
    return null;
  }

  const target = getUploadTarget({ language, ownerId });

  const upload = await uploadAudio({
    access: target.access,
    audio: voiced.audio,
    fileName: `${target.fileName}.${voiced.format}`,
  });

  if (upload.error) {
    return null;
  }

  const { row } = await createOrFindByIdentity({
    create: () =>
      prisma.mediaAsset.create({
        data: {
          durationMs: voiced.durationMs,
          kind: "audio",
          language,
          mimeType: AUDIO_MIME_TYPE,
          ownerId,
          prompt: text,
          reuseKey,
          url: upload.data,
          visibility: ownerId ? "private" : "public",
          ...toProvenanceData(voiced.provenance),
        },
      }),
    findExisting: () => findSpeechClip(reuseKey),
  });

  return row;
}

export function voiceSpeechClip(
  input: Parameters<typeof voiceClip>[0],
): Promise<MediaAsset | null> {
  const pending = voicing.get(input.reuseKey);

  if (pending) {
    return pending;
  }

  const started = voiceClip(input).finally(() => voicing.delete(input.reuseKey));
  voicing.set(input.reuseKey, started);
  return started;
}

export function isVoicingSpeechClip(reuseKey: string): boolean {
  return voicing.has(reuseKey);
}
