import "server-only";
import { createHash } from "node:crypto";
import { BlobNotFoundError, get, head, put } from "@vercel/blob";
import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import { type ServiceTier } from "@zoonk/ai/provider-options";
import {
  type ListeningPart,
  getListeningVoicePromptVersion,
  voiceListeningPart,
} from "@zoonk/ai/tasks/audio/listening";
import { z } from "zod";

const PART_LIFETIME_DAYS = 7;

type PartAddress = { index: number; part: ListeningPart; reuseKey: string };

const storedPart = z.object({
  audio: z.string(),
  generatedAt: z.iso.datetime(),
  model: z.string().min(1),
  promptVersion: z.string(),
  runId: z.string(),
});

function getPartPath({ index, part, reuseKey }: PartAddress) {
  const key = [
    reuseKey,
    index,
    part.turn,
    part.voice,
    part.accent,
    part.text,
    getListeningVoicePromptVersion(),
  ];

  const hash = createHash("sha256").update(JSON.stringify(key)).digest("hex");
  return `library/listening/parts/${hash}.json`;
}

export async function storeListeningPart({
  attempt,
  analytics,
  language,
  serviceTier,
  ...address
}: PartAddress & {
  attempt: number;
  analytics?: AiGenerationContext;
  language: string;
  serviceTier?: ServiceTier;
}): Promise<void> {
  const path = getPartPath(address);

  try {
    await head(path);
    return;
  } catch (error) {
    if (!(error instanceof BlobNotFoundError)) {
      throw error;
    }
  }

  const { audio, provenance } = await voiceListeningPart({
    analytics: { ...analytics, contentScope: "shared" },
    attempt,
    language,
    part: address.part,
    serviceTier,
  });

  const { generatedAt, model, promptVersion, runId } = provenance;

  await put(
    path,
    JSON.stringify({
      audio: Buffer.from(audio).toString("base64"),
      generatedAt,
      model,
      promptVersion,
      runId,
    }),
    {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60,
      contentType: "application/json",
      ttlDays: PART_LIFETIME_DAYS,
    },
  );
}

export async function readListeningPart(address: PartAddress) {
  const blob = await get(getPartPath(address), { access: "public" });

  if (!blob?.stream) {
    throw new Error(`Missing listening audio segment ${address.index}`);
  }

  const { audio, ...provenance } = storedPart.parse(await new Response(blob.stream).json());

  return {
    ...provenance,
    audio: Buffer.from(audio, "base64"),
    text: address.part.text,
    turn: address.part.turn,
  };
}
