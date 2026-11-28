import "server-only";
import { isDeepStrictEqual } from "node:util";
import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { type ClipEndingCheck, checkClipEnding } from "@zoonk/ai/tasks/audio/check-clip-ending";
import { prisma } from "@zoonk/db";
import { chunk } from "@zoonk/utils/chunk";
import { safeAsync } from "@zoonk/utils/error";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { logError } from "@zoonk/utils/logger";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { targetsOf } from "./content-fixes/_utils/prepare-content-fix";
import { contentFixChangesSchema } from "./content-fixes/contract";
import {
  CLIP_COLUMNS,
  UNIT_KIND,
  type VocabularyModel,
  toClipData,
} from "./content-fixes/handlers/vocabulary-row";
import { staffRead } from "./read";

const DEFAULT_CLIPS_PER_PAGE = 24;
const MAX_CLIPS_PER_PAGE = 96;
const CLIPS_AT_ONCE = 12;
const DOWNLOAD_TIMEOUT_MS = 8000;
const LISTEN_TIMEOUT_MS = 20_000;
const AUDIT_CLAIM_TTL_MS = 360_000;
const AUDIT_MODEL = "google/gemini-3.8-flash";
const AUDIO_MEDIA_TYPE = "audio/mpeg";

const auditClipsSchema = z.strictObject({
  after: uuidSchema().optional(),
  kind: z.enum(["words", "sentences"]),
  limit: z.int().min(1).max(MAX_CLIPS_PER_PAGE).default(DEFAULT_CLIPS_PER_PAGE),
  voicedBefore: z.union([z.iso.datetime({ offset: true }), z.iso.date()]).optional(),
});

type AuditPage = z.infer<typeof auditClipsSchema>;

type StoredClip = {
  audio: ReturnType<typeof toClipData>;
  id: string;
  language: string;
  model: VocabularyModel;
  text: string;
};

async function listClips({ after, kind, limit, voicedBefore }: AuditPage): Promise<StoredClip[]> {
  const before = voicedBefore ? new Date(voicedBefore) : undefined;
  const paging = { orderBy: { id: "asc" }, take: limit + 1 } as const;
  const where = { id: { gt: after } };

  const vocabularyWhere = {
    ...where,
    OR: before ? [{ audioGeneratedAt: null }, { audioGeneratedAt: { lt: before } }] : undefined,
    audioUrl: { not: null },
  };

  const select = { ...CLIP_COLUMNS, id: true, targetLanguage: true } as const;

  if (kind === "words") {
    const rows = await prisma.word.findMany({
      ...paging,
      select: { ...select, word: true },
      where: vocabularyWhere,
    });

    return rows.map(({ id, targetLanguage, word, ...audio }) => ({
      audio,
      id,
      language: targetLanguage,
      model: "Word",
      text: word,
    }));
  }

  const rows = await prisma.sentence.findMany({
    ...paging,
    select: { ...select, sentence: true },
    where: vocabularyWhere,
  });

  return rows.map(({ id, sentence, targetLanguage, ...audio }) => ({
    audio,
    id,
    language: targetLanguage,
    model: "Sentence",
    text: sentence,
  }));
}

async function clipsToSkip(clips: StoredClip[]) {
  const [first] = clips;
  const skip = new Set<string>();

  if (!first) {
    return skip;
  }

  const clipsById = new Map(clips.map((clip) => [clip.id, clip]));

  const fixes = await prisma.contentFix.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { changes: true, status: true },
    where: { unit: UNIT_KIND[first.model], unitId: { in: [...clipsById.keys()] } },
  });

  const reviewedChanges = fixes.flatMap(({ changes, status }) =>
    contentFixChangesSchema.parse(changes).map((change) => ({ change, status })),
  );

  const seenRevoice = new Set<string>();

  for (const { change, status } of reviewedChanges) {
    if (status === "proposed" || status === "approved") {
      for (const { id, model, part } of targetsOf(change)) {
        if (model === first.model && part === "audio") {
          skip.add(id);
        }
      }
    }

    if (change.op === "revoice" && change.model === first.model && !seenRevoice.has(change.id)) {
      seenRevoice.add(change.id);
      const clip = clipsById.get(change.id);

      if (
        status === "rejected" &&
        clip &&
        isDeepStrictEqual(clip.audio, toClipData(change.before))
      ) {
        skip.add(change.id);
      }
    }
  }

  return skip;
}

function timedSignal({ signal, timeoutMs }: { signal?: AbortSignal; timeoutMs: number }) {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function uncheckedClip({
  clip: { id, model },
  error,
  reason,
}: {
  clip: StoredClip;
  error?: Error;
  reason: string;
}) {
  const entry = { id, model, reason };
  const statusCode = error && "statusCode" in error ? error.statusCode : undefined;

  logError("staff.audit-clips.unchecked", {
    ...entry,
    errorName: error?.name,
    statusCode: typeof statusCode === "number" ? statusCode : undefined,
  });

  return { entry, status: "unchecked" } as const;
}

function failureReason({
  operation,
  request,
  signal,
}: {
  operation: "Download" | "Listen";
  request?: AbortSignal;
  signal: AbortSignal;
}) {
  if (request?.aborted) {
    return "Request canceled.";
  }

  return signal.aborted ? `${operation} timed out.` : `${operation} failed.`;
}

async function downloadClip({ signal, url }: { signal: AbortSignal; url: string }) {
  const response = await fetch(url, { redirect: "error", signal });

  if (!response.ok) {
    return { reason: `Download returned HTTP ${String(response.status)}.` };
  }

  const audio = new Uint8Array(await response.arrayBuffer());

  if (audio.length === 0) {
    return { reason: "Download returned an empty clip." };
  }

  const [contentType] = response.headers.get("content-type")?.split(";") ?? [];
  const mediaType = contentType?.startsWith("audio/") ? contentType : AUDIO_MEDIA_TYPE;

  return { audio, mediaType };
}

async function listenToClip({
  audioUrl,
  clip,
  signal,
}: {
  audioUrl: string;
  clip: StoredClip;
  signal?: AbortSignal;
}) {
  const downloadSignal = timedSignal({ signal, timeoutMs: DOWNLOAD_TIMEOUT_MS });
  const download = await safeAsync(() => downloadClip({ signal: downloadSignal, url: audioUrl }));

  if (download.error) {
    return uncheckedClip({
      clip,
      error: download.error,
      reason: failureReason({ operation: "Download", request: signal, signal: downloadSignal }),
    });
  }

  if (download.data.reason !== undefined) {
    return uncheckedClip({ clip, reason: download.data.reason });
  }

  const { audio, mediaType } = download.data;
  const abortSignal = timedSignal({ signal, timeoutMs: LISTEN_TIMEOUT_MS });

  const listen = await safeAsync(() =>
    checkClipEnding({
      abortSignal,
      audio,
      language: clip.language,
      mediaType,
      model: AUDIT_MODEL,
      serviceTier: chooseServiceTier({ wait: "soon" }),
      text: clip.text,
    }),
  );

  if (listen.error) {
    return uncheckedClip({
      clip,
      error: listen.error,
      reason: failureReason({ operation: "Listen", request: signal, signal: abortSignal }),
    });
  }

  return { status: "heard", verdict: listen.data.data } as const;
}

function auditResult({
  clip: { id, language, model, text },
  verdict: { added, heard },
}: {
  clip: StoredClip;
  verdict: ClipEndingCheck;
}) {
  return added === "none"
    ? ({ status: "clean" } as const)
    : ({ entry: { added, heard, id, language, model, text }, status: "flagged" } as const);
}

async function auditClip({ clip, signal }: { clip: StoredClip; signal?: AbortSignal }) {
  const { audioUrl } = clip.audio;

  if (!audioUrl || !clip.language || !clip.text) {
    return uncheckedClip({ clip, reason: "Clip is missing a URL, language, or text." });
  }

  const recording = { audioUrl, clipId: clip.id, unit: UNIT_KIND[clip.model] };
  const where = { recording };
  const current = await prisma.clipEndingAudit.findUnique({ where });

  if (current?.added) {
    return auditResult({ clip, verdict: { added: current.added, heard: current.heard } });
  }

  const now = new Date();
  const claimExpiresAt = new Date(now.getTime() + AUDIT_CLAIM_TTL_MS);

  const claim = current
    ? await prisma.clipEndingAudit.updateMany({
        data: { claimExpiresAt },
        where: { ...recording, added: null, claimExpiresAt: { lte: now } },
      })
    : await prisma.clipEndingAudit.createMany({
        data: { ...recording, claimExpiresAt },
        skipDuplicates: true,
      });

  if (claim.count === 0) {
    const replay = await prisma.clipEndingAudit.findUnique({ where });

    return replay?.added
      ? auditResult({ clip, verdict: { added: replay.added, heard: replay.heard } })
      : uncheckedClip({ clip, reason: "Another audit claimed this clip. Retry this page." });
  }

  const result = await listenToClip({ audioUrl, clip, signal });
  const ownedClaim = { ...recording, added: null, claimExpiresAt };

  if (result.status === "unchecked") {
    await prisma.clipEndingAudit.deleteMany({ where: ownedClaim });
    return result;
  }

  const saved = await prisma.clipEndingAudit.updateMany({
    data: result.verdict,
    where: ownedClaim,
  });

  return saved.count === 0
    ? uncheckedClip({ clip, reason: "The audit claim expired. Retry this page." })
    : auditResult({ clip, verdict: result.verdict });
}

async function auditPage({ page, signal }: { page: AuditPage; signal?: AbortSignal }) {
  const rows = await listClips(page);
  const clips = rows.slice(0, page.limit);
  const skip = await clipsToSkip(clips);
  const candidates = clips.filter(({ id }) => !skip.has(id));
  const results = [];

  for (const batch of chunk(candidates, CLIPS_AT_ONCE)) {
    // oxlint-disable-next-line no-await-in-loop -- Finish this group before opening more downloads and model calls.
    results.push(...(await Promise.all(batch.map((clip) => auditClip({ clip, signal })))));
  }

  const entries = results.flatMap((result) => (result.status === "flagged" ? [result.entry] : []));

  const uncheckedEntries = results.flatMap((result) =>
    result.status === "unchecked" ? [result.entry] : [],
  );

  const fixes = entries
    .filter(({ language }) => isTTSSupportedLanguage(language))
    .map(({ id, model }) => ({ changes: [{ id, model, revoice: true as const }] }));

  return {
    data: {
      entries,
      fixes,
      flagged: entries.length,
      listened: results.length - uncheckedEntries.length,
      next: rows.length > clips.length ? (clips.at(-1)?.id ?? null) : null,
      skipped: clips.length - candidates.length,
      unchecked: uncheckedEntries.length,
      uncheckedEntries,
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
