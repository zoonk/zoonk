import "server-only";
import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import { type ServiceTier } from "@zoonk/ai/provider-options";
import { voiceListeningScript } from "@zoonk/ai/tasks/audio/listening";
import { type MediaAsset, prisma } from "@zoonk/db";
import { uploadAudio } from "../../audio/upload-audio";
import { createOrFindByIdentity, toProvenanceData } from "../_utils/library-rows";
import { getListeningAudioKey } from "./listening-audio-key";
import { type ListeningContent, listeningContentSchema } from "./listening-content";

const AUDIO_MIME_TYPE = "audio/mpeg";

/**
 * Recordings being voiced on this server, by reuse key, so two requests for the same script (two
 * learners starting the same set) wait for one voicing instead of paying twice. Other servers rely
 * on the reuse key's unique constraint.
 */
const voicing = new Map<string, Promise<MediaAsset | null>>();

function findRecording(reuseKey: string): Promise<MediaAsset | null> {
  return prisma.mediaAsset.findUnique({ where: { reuseKey } });
}

/** Voices the script, uploads it to the public Library folder and stores it under its key. */
async function voiceRecording({
  analytics,
  content,
  reuseKey,
  serviceTier,
}: {
  analytics?: AiGenerationContext;
  content: ListeningContent;
  reuseKey: string;
  serviceTier?: ServiceTier;
}): Promise<MediaAsset | null> {
  const stored = await findRecording(reuseKey);

  if (stored) {
    return stored;
  }

  const speakers = new Map(content.script.speakers.map((speaker) => [speaker.key, speaker]));

  const lines = content.script.turns.flatMap((turn) => {
    const speaker = speakers.get(turn.speaker);
    return speaker ? [{ accent: speaker.accent, text: turn.text, voice: speaker.voice }] : [];
  });

  const { data: voiced, error } = await voiceListeningScript({
    analytics: { ...analytics, contentScope: "shared" },
    language: content.scriptLanguage,
    lines,
    serviceTier,
  });

  if (error) {
    return null;
  }

  const upload = await uploadAudio({
    audio: voiced.audio,
    fileName: `library/listening/${content.scriptLanguage}.${voiced.format}`,
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
          language: content.scriptLanguage,
          mimeType: AUDIO_MIME_TYPE,
          prompt: content.script.turns.map((turn) => turn.text).join("\n"),
          reuseKey,
          url: upload.data,
          visibility: "public",
          ...toProvenanceData(voiced.provenance),
        },
      }),
    findExisting: () => findRecording(reuseKey),
  });

  return row;
}

function voiceRecordingOnce(input: Parameters<typeof voiceRecording>[0]) {
  const pending = voicing.get(input.reuseKey);

  if (pending) {
    return pending;
  }

  const started = voiceRecording(input).finally(() => voicing.delete(input.reuseKey));
  voicing.set(input.reuseKey, started);
  return started;
}

/**
 * The recording of an audio set, voiced the first time anyone needs it and shared after that: a
 * set already voiced plays its file, a set whose script another set already voiced gets that file
 * (one reuse key per script, voices and accents), and only a new script is voiced. Null when the
 * set isn't an audio set or the voicing failed; the set stays unvoiced and is voiced again the next
 * time it's needed. Called from work a learner or the goal's setup started, never on render.
 */
export async function voiceListeningSet({
  analytics,
  serviceTier,
  setId,
}: {
  analytics?: AiGenerationContext;
  serviceTier?: ServiceTier;
  setId: string;
}): Promise<MediaAsset | null> {
  const set = await prisma.itemSet.findUnique({
    include: { mediaAsset: true },
    where: { id: setId },
  });

  if (!set || set.kind !== "audio") {
    return null;
  }

  if (set.mediaAsset) {
    return set.mediaAsset;
  }

  const content = listeningContentSchema.parse(set.content);
  const reuseKey = getListeningAudioKey(content);
  const recording = await voiceRecordingOnce({ analytics, content, reuseKey, serviceTier });

  if (recording) {
    await prisma.itemSet.updateMany({
      data: { mediaAssetId: recording.id },
      where: { id: set.id, mediaAssetId: null },
    });
  }

  return recording;
}
