import "server-only";
import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import { type ServiceTier } from "@zoonk/ai/provider-options";
import { voiceListeningScript } from "@zoonk/ai/tasks/audio/listening";
import { type MediaAsset, prisma } from "@zoonk/db";
import { uploadAudio } from "../../audio/upload-audio";
import { createOrFindByIdentity, toProvenanceData } from "../_utils/library-rows";
import { lockPlanSourceWrite, writePlanInputs } from "../_utils/plan-input-write";
import { getListeningAudioKey } from "./listening-audio-key";
import { type ListeningContent, listeningContentSchema } from "./listening-content";

const AUDIO_MIME_TYPE = "audio/mpeg";

const voicing = new Map<string, Promise<MediaAsset | null>>();

function findRecording(reuseKey: string): Promise<MediaAsset | null> {
  return prisma.mediaAsset.findUnique({ where: { reuseKey } });
}

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

/** Call only from learner-started or goal-setup work, never during rendering. */
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
    await writePlanInputs(async (tx) => {
      const questions = await tx.item.findMany({
        select: { examBlueprintId: true, skillId: true },
        where: { setId: set.id },
      });

      await lockPlanSourceWrite(tx, {
        blueprintIds: [
          ...new Set([set, ...questions].flatMap(({ examBlueprintId }) => examBlueprintId ?? [])),
        ],
        skillIds: [...new Set(questions.map(({ skillId }) => skillId))],
      });

      await tx.itemSet.updateMany({
        data: { mediaAssetId: recording.id },
        where: { id: set.id, mediaAssetId: null },
      });
    });
  }

  return recording;
}
