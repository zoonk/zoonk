import "server-only";
import { combineStoredProvenance } from "@zoonk/ai/combine-task-provenance";
import {
  type ListeningPart,
  joinListeningParts,
  splitListeningParts,
} from "@zoonk/ai/tasks/audio/listening";
import { type ItemSet, prisma } from "@zoonk/db";
import { uploadAudio } from "../../audio/upload-audio";
import { createOrFindByIdentity, toProvenanceData } from "../_utils/library-rows";
import { lockPlanSourceWrite, writePlanInputs } from "../_utils/plan-input-write";
import { getListeningAudioKey } from "./listening-audio-key";
import { readListeningPart } from "./listening-audio-part";
import { type ListeningContent, listeningContentSchema } from "./listening-content";

export { storeListeningPart } from "./listening-audio-part";

function findRecording(reuseKey: string) {
  return prisma.mediaAsset.findUnique({ where: { reuseKey } });
}

async function attachRecording(set: ItemSet, mediaAssetId: string) {
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

    const updated = await tx.itemSet.updateMany({
      data: { mediaAssetId },
      where: { id: set.id, mediaAssetId: null, updatedAt: set.updatedAt },
    });

    if (!updated.count) {
      const current = await tx.itemSet.findUnique({
        select: { mediaAssetId: true },
        where: { id: set.id },
      });

      if (current?.mediaAssetId !== mediaAssetId) {
        throw new Error("Listening set changed before its recording was attached");
      }
    }
  });
}

type RecordingPlan =
  | { status: "ready" }
  | { status: "missing" }
  | { status: "unvoiced"; language: string; parts: ListeningPart[]; reuseKey: string };

function splitScript(content: ListeningContent) {
  const speakers = new Map(content.script.speakers.map((speaker) => [speaker.key, speaker]));

  const lines = content.script.turns.map((turn) => {
    const speaker = speakers.get(turn.speaker);

    if (!speaker) {
      throw new Error("Missing listening speaker");
    }

    return { accent: speaker.accent, text: turn.text, voice: speaker.voice };
  });

  return splitListeningParts({ language: content.scriptLanguage, lines });
}

async function loadRecording(setId: string) {
  const set = await prisma.itemSet.findUnique({ where: { id: setId } });

  if (!set || set.kind !== "audio") {
    return { status: "missing" } as const;
  }

  if (set.mediaAssetId) {
    return { status: "ready" } as const;
  }

  const content = listeningContentSchema.parse(set.content);
  const reuseKey = getListeningAudioKey(content);
  const existing = await findRecording(reuseKey);

  if (existing) {
    await attachRecording(set, existing.id);
    return { status: "ready" } as const;
  }

  return { content, reuseKey, set, status: "unvoiced" } as const;
}

export async function findListeningRecording(setId: string) {
  const recording = await loadRecording(setId);

  return recording.status === "unvoiced"
    ? { reuseKey: recording.reuseKey, status: recording.status }
    : recording;
}

export async function prepareListeningRecording(setId: string): Promise<RecordingPlan> {
  const recording = await loadRecording(setId);

  if (recording.status !== "unvoiced") {
    return recording;
  }

  const { content, reuseKey } = recording;

  return {
    language: content.scriptLanguage,
    parts: splitScript(content),
    reuseKey,
    status: "unvoiced",
  };
}

export async function publishListeningRecording({
  setId,
  reuseKey,
}: {
  setId: string;
  reuseKey: string;
}): Promise<boolean> {
  const recording = await loadRecording(setId);

  if (recording.status !== "unvoiced") {
    return recording.status === "ready";
  }

  if (recording.reuseKey !== reuseKey) {
    return false;
  }

  const { content, set } = recording;

  const parts = await Promise.all(
    splitScript(content).map((part, index) => readListeningPart({ index, part, reuseKey })),
  );

  const provenance = combineStoredProvenance(parts);
  const voiced = await joinListeningParts(parts);

  const upload = await uploadAudio({
    audio: voiced.audio,
    fileName: `library/listening/${content.scriptLanguage}.${voiced.format}`,
  });

  if (upload.error) {
    throw upload.error;
  }

  const { row } = await createOrFindByIdentity({
    create: () =>
      prisma.mediaAsset.create({
        data: {
          durationMs: voiced.durationMs,
          kind: "audio",
          language: content.scriptLanguage,
          mimeType: "audio/mpeg",
          prompt: content.script.turns.map((turn) => turn.text).join("\n"),
          reuseKey,
          url: upload.data,
          visibility: "public",
          ...toProvenanceData(provenance),
        },
      }),
    findExisting: () => findRecording(reuseKey),
  });

  await attachRecording(set, row.id);
  return true;
}
