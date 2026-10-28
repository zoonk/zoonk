import "server-only";
import { generateLanguageAudio } from "@zoonk/ai/tasks/audio";
import { type MediaAsset, prisma } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { getPrivateAudioFolder } from "@zoonk/utils/user-blobs";
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

function getUploadTarget({ language, ownerId }: { language: string; ownerId: string | null }) {
  return ownerId
    ? { access: "private" as const, fileName: `${getPrivateAudioFolder(ownerId)}${language}` }
    : { access: "public" as const, fileName: `library/audio/${language}` };
}

async function voiceClip({
  language,
  ownerId,
  reuseKey,
  text,
  userId,
}: {
  language: string;
  ownerId: string | null;
  reuseKey: string;
  text: string;
  userId: string;
}): Promise<MediaAsset | null> {
  const stored = await findClip(reuseKey);

  if (stored) {
    return stored;
  }

  const { data: voiced, error } = await generateLanguageAudio({
    analytics: { contentScope: ownerId ? "personal" : "shared", distinctId: userId },
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

/** Requires a signed-in learner or guest. Call only after a learner action: a new clip spends AI help. */
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
  const ownerId = parsed.data.personal ? session.user.id : null;
  const reuseKey = getSpeechClipKey({ language, ownerId, text });
  const stored = await findClip(reuseKey);

  if (stored) {
    return { clip: toSpeechClip(stored), status: "ready" };
  }

  const usage = voicing.has(reuseKey) ? null : await claimAssist();

  if (usage && usage.status !== "allowed") {
    return usage;
  }

  const created = await voiceClipOnce({
    language,
    ownerId,
    reuseKey,
    text,
    userId: session.user.id,
  });

  return created ? { clip: toSpeechClip(created), status: "ready" } : { status: "failed" };
}
