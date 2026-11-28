import "server-only";
import { checkClipEnding } from "@zoonk/ai/tasks/audio/check-clip-ending";
import { prisma } from "@zoonk/db";
import { chunk } from "@zoonk/utils/chunk";
import { safeAsync } from "@zoonk/utils/error";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { SPEECH_CLIP_KEY_PREFIX } from "../audio/speech-clip-key";
import { targetsOf } from "./content-fixes/_utils/prepare-content-fix";
import { MAX_BATCH_FIXES } from "./content-fixes/batches";
import { contentFixChangesSchema } from "./content-fixes/contract";
import { UNIT_KIND } from "./content-fixes/handlers/vocabulary-row";
import { staffRead } from "./read";

const DEFAULT_CLIPS_PER_PAGE = 100;

const auditClipsSchema = z.strictObject({
  after: uuidSchema().optional(),
  kind: z.enum(["words", "sentences", "speech"]),
  limit: z.int().min(1).max(MAX_BATCH_FIXES).default(DEFAULT_CLIPS_PER_PAGE),
  voicedBefore: z.union([z.iso.datetime({ offset: true }), z.iso.date()]).optional(),
});

type AuditPage = z.infer<typeof auditClipsSchema>;
type ClipModel = "Word" | "Sentence" | "MediaAsset";

type StoredClip = {
  id: string;
  language: string | null;
  model: ClipModel;
  text: string | null;
  url: string | null;
};

const CLIPS_AT_ONCE = 12;
const CLIP_TIMEOUT_MS = 12_000;
const AUDIO_MEDIA_TYPE = "audio/mpeg";

async function listClips({ after, kind, limit, voicedBefore }: AuditPage): Promise<StoredClip[]> {
  const before = voicedBefore ? new Date(voicedBefore) : undefined;
  const paging = { orderBy: { id: "asc" }, take: limit + 1 } as const;
  const where = { id: { gt: after } };

  if (kind === "speech") {
    const rows = await prisma.mediaAsset.findMany({
      ...paging,
      select: { id: true, language: true, prompt: true, url: true },
      where: {
        ...where,
        generatedAt: before && { lt: before },
        kind: "audio",
        ownerId: null,
        reuseKey: { startsWith: SPEECH_CLIP_KEY_PREFIX },
        visibility: "public",
      },
    });

    return rows.map(({ prompt, ...row }) => ({ ...row, model: "MediaAsset", text: prompt }));
  }

  const vocabularyWhere = {
    ...where,
    OR: before ? [{ audioGeneratedAt: null }, { audioGeneratedAt: { lt: before } }] : undefined,
    audioUrl: { not: null },
  };

  const select = { audioUrl: true, id: true, targetLanguage: true } as const;

  if (kind === "words") {
    const rows = await prisma.word.findMany({
      ...paging,
      select: { ...select, word: true },
      where: vocabularyWhere,
    });

    return rows.map(({ audioUrl, id, targetLanguage, word }) => ({
      id,
      language: targetLanguage,
      model: "Word",
      text: word,
      url: audioUrl,
    }));
  }

  const rows = await prisma.sentence.findMany({
    ...paging,
    select: { ...select, sentence: true },
    where: vocabularyWhere,
  });

  return rows.map(({ audioUrl, id, sentence, targetLanguage }) => ({
    id,
    language: targetLanguage,
    model: "Sentence",
    text: sentence,
    url: audioUrl,
  }));
}

async function clipsWithWaitingFixes(clips: StoredClip[]) {
  const [first] = clips;

  if (!first || first.model === "MediaAsset") {
    return new Set<string>();
  }

  const fixes = await prisma.contentFix.findMany({
    select: { changes: true },
    where: {
      status: { in: ["proposed", "approved"] },
      unit: UNIT_KIND[first.model],
      unitId: { in: clips.map(({ id }) => id) },
    },
  });

  return new Set(
    fixes.flatMap(({ changes }) =>
      contentFixChangesSchema
        .parse(changes)
        .flatMap((change) => targetsOf(change))
        .filter(({ model, part }) => model === first.model && part === "audio")
        .map(({ id }) => id),
    ),
  );
}

async function listenToClip({
  clip: { id, language, model, text, url },
  signal,
}: {
  clip: StoredClip;
  signal?: AbortSignal;
}) {
  if (!url || !language || !text) {
    return { status: "unchecked" } as const;
  }

  const timeout = AbortSignal.timeout(CLIP_TIMEOUT_MS);
  const abortSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;

  const { data } = await safeAsync(async () => {
    const response = await fetch(url, { redirect: "error", signal: abortSignal });

    if (!response.ok) {
      return null;
    }

    const audio = new Uint8Array(await response.arrayBuffer());

    if (audio.length === 0) {
      return null;
    }

    const [contentType] = response.headers.get("content-type")?.split(";") ?? [];
    const mediaType = contentType?.startsWith("audio/") ? contentType : AUDIO_MEDIA_TYPE;
    const input = { abortSignal, audio, language, mediaType, serviceTier: "flex" as const, text };
    const first = await checkClipEnding(input);

    if (first.data.added === "none") {
      return first.data;
    }

    const confirmation = await checkClipEnding(input);
    return confirmation.data;
  });

  if (!data) {
    return { status: "unchecked" } as const;
  }

  return data.added === "none"
    ? ({ status: "clean" } as const)
    : ({
        entry: { added: data.added, heard: data.heard, id, language, model, text },
        status: "flagged",
      } as const);
}

async function auditPage({ page, signal }: { page: AuditPage; signal?: AbortSignal }) {
  const rows = await listClips(page);
  const clips = rows.slice(0, page.limit);
  const waiting = await clipsWithWaitingFixes(clips);
  const candidates = clips.filter(({ id }) => !waiting.has(id));
  const results = [];

  for (const batch of chunk(candidates, CLIPS_AT_ONCE)) {
    // oxlint-disable-next-line no-await-in-loop -- Finish this group before opening more downloads and model calls.
    results.push(...(await Promise.all(batch.map((clip) => listenToClip({ clip, signal })))));
  }

  const entries = results.flatMap((result) => (result.status === "flagged" ? [result.entry] : []));
  const unchecked = results.filter(({ status }) => status === "unchecked").length;

  const fixes = entries.flatMap(({ id, model }) =>
    model === "MediaAsset" ? [] : [{ changes: [{ id, model, revoice: true as const }] }],
  );

  return {
    data: {
      entries,
      ...(page.kind === "speech" ? {} : { fixes }),
      flagged: entries.length,
      listened: results.length - unchecked,
      next: rows.length > clips.length ? (clips.at(-1)?.id ?? null) : null,
      skipped: clips.length - candidates.length,
      unchecked,
    },
    rows: clips.length,
  };
}

export function auditStoredClips({ input, signal }: { input: unknown; signal?: AbortSignal }) {
  return staffRead({
    call: { verb: "audit-clips" },
    input,
    run: (page) => auditPage({ page, signal }),
    schema: auditClipsSchema,
  });
}
