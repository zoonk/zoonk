import "server-only";
import { generateLanguageAudio } from "@zoonk/ai/tasks/audio";
import { type MediaAsset, prisma } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { claimAssist } from "../entitlements/claim-usage";
import { type RefusedUsage } from "../entitlements/contract";
import { createOrFindByIdentity, toProvenanceData } from "../library/_utils/library-rows";
import { getSession } from "../users/get-session";
import {
  type SpeechClip,
  type SpeechClipInput,
  normalizeSpeechText,
  speechClipInputSchema,
} from "./speech-clip-contract";
import { getSpeechClipKey } from "./speech-clip-key";
import { uploadAudio } from "./upload-audio";

type RequestSpeechClipResult =
  | { status: "unauthorized" }
  | { status: "invalid" }
  | { status: "failed" }
  | RefusedUsage
  | { clip: SpeechClip; status: "ready" };

const AUDIO_MIME_TYPE = "audio/mpeg";

/**
 * Clips being voiced on this server, by reuse key, so a second request for the same words (a
 * double tap, two learners on the same passage) waits for the first instead of paying again.
 * Other servers rely on the reuse key's unique constraint.
 */
const voicing = new Map<string, Promise<MediaAsset | null>>();

function toSpeechClip(asset: MediaAsset): SpeechClip {
  return {
    durationMs: asset.durationMs,
    id: asset.id,
    language: asset.language ?? "",
    url: asset.url,
  };
}

function findClip(reuseKey: string): Promise<MediaAsset | null> {
  return prisma.mediaAsset.findUnique({ where: { reuseKey } });
}

/**
 * Voices the text, uploads it to the public Library folder and stores it under its reuse key. A
 * clip stored while this request waited for its claim is used as is; when another server saves the
 * same key while this one voices it, its clip wins and this one's file is left unused.
 */
async function voiceClip({
  language,
  reuseKey,
  text,
  userId,
}: {
  language: string;
  reuseKey: string;
  text: string;
  userId: string;
}): Promise<MediaAsset | null> {
  const stored = await findClip(reuseKey);

  if (stored) {
    return stored;
  }

  const { data: voiced, error } = await generateLanguageAudio({
    analytics: { distinctId: userId },
    language,
    text,
  });

  if (error) {
    logError("Error voicing a speech clip:", error);
    return null;
  }

  const upload = await uploadAudio({
    audio: voiced.audio,
    fileName: `library/audio/${language}.${voiced.format}`,
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
          prompt: text,
          reuseKey,
          url: upload.data,
          ...toProvenanceData(voiced.provenance),
        },
      }),
    findExisting: () => findClip(reuseKey),
  });

  return row;
}

function voiceClipOnce(input: Parameters<typeof voiceClip>[0]): Promise<MediaAsset | null> {
  const pending = voicing.get(input.reuseKey);

  if (pending) {
    return pending;
  }

  const started = voiceClip(input).finally(() => voicing.delete(input.reuseKey));
  voicing.set(input.reuseKey, started);
  return started;
}

/**
 * A playable clip of `text` read aloud in `language`, for the signed-in learner or guest. Clips
 * are shared: the same words in the same language play the stored file, and only a new clip is
 * voiced (Gemini text-to-speech) and claimed as small AI help. It's called from a learner's tap,
 * never on render, because a new clip costs a model call.
 */
export async function requestSpeechClip(input: SpeechClipInput): Promise<RequestSpeechClipResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const parsed = speechClipInputSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "invalid" };
  }

  const language = parsed.data.language;
  const text = normalizeSpeechText(parsed.data.text);
  const reuseKey = getSpeechClipKey({ language, text });
  const stored = await findClip(reuseKey);

  if (stored) {
    return { clip: toSpeechClip(stored), status: "ready" };
  }

  const usage = voicing.has(reuseKey) ? null : await claimAssist();

  if (usage && usage.status !== "allowed") {
    return usage;
  }

  const created = await voiceClipOnce({ language, reuseKey, text, userId: session.user.id });

  return created ? { clip: toSpeechClip(created), status: "ready" } : { status: "failed" };
}
