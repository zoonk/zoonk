import { checkClipEnding } from "@zoonk/ai/tasks/audio/check-clip-ending";
import { STAFF_READ_SCOPE } from "@zoonk/auth/cli-login-contract";
import { prisma } from "@zoonk/db";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import * as logger from "@zoonk/utils/logger";
import { headers } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cliTokenFixture } from "../../../auth/src/_test-utils/cli-tokens";
import { auditStoredClips } from "./audit-clips";

// Use the real staff login and database without calling the paid listening model.
vi.mock("@zoonk/ai/tasks/audio/check-clip-ending", () => ({ checkClipEnding: vi.fn() }));

const listen = vi.mocked(checkClipEnding, { partial: true });
const cutoff = "2026-11-27T12:00:00.000Z";
const old = new Date("2026-11-26T12:00:00.000Z");
const cursor = "ffffffff-ffff-4fff-8fff-000000000000";

function clipId(number: number, prefix = "ffffffff") {
  return `${prefix}-ffff-4fff-8fff-${String(number).padStart(12, "0")}`;
}

function clipUrl(number: number) {
  return `https://example.test/${String(number)}.mp3`;
}

async function wordToAudit(number: number) {
  const { id: organizationId } = await organizationFixture();

  const word = await prisma.word.create({
    data: {
      audioUrl: clipUrl(number),
      id: clipId(number, "fffffffe"),
      organizationId,
      targetLanguage: "en",
      word: "living in",
    },
  });

  return {
    audit: () =>
      auditStoredClips({
        input: { after: clipId(number - 1, "fffffffe"), kind: "words", limit: 1 },
      }),
    id: word.id,
  };
}

function priorFix({
  beforeGeneratedAt,
  beforeUrl = clipUrl(1),
  createdAt,
  id,
  status,
  revoice,
}: {
  beforeGeneratedAt?: string;
  beforeUrl?: string;
  createdAt?: Date;
  id: string;
  status: "proposed" | "approved" | "applied" | "rejected";
  revoice: boolean;
}) {
  const change = revoice
    ? {
        before: {
          audioGeneratedAt: beforeGeneratedAt ?? null,
          audioModel: null,
          audioPromptVersion: null,
          audioRunId: null,
          audioUrl: beforeUrl,
        },
        op: "revoice",
        text: "living in",
      }
    : { fields: [{ after: "líving in", before: null, field: "romanization" }], op: "set" };

  return prisma.contentFix.create({
    data: {
      batchId: crypto.randomUUID(),
      changes: [{ ...change, id, model: "Word" }],
      createdAt,
      effects: [],
      media: [],
      proposerClientId: "test",
      reason: "Fix the word",
      status,
      unit: "word",
      unitId: id,
    },
  });
}

describe(auditStoredClips, () => {
  beforeEach(async () => {
    const user = await userFixture({ role: "admin" });
    const { accessToken } = await cliTokenFixture({ scopes: [STAFF_READ_SCOPE], user });

    vi.mocked(headers).mockResolvedValue(new Headers({ authorization: `Bearer ${accessToken}` }));

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (url === clipUrl(11)) {
        return new Response(null, { status: 404 });
      }

      if (url === clipUrl(13)) {
        return new Response("wav", { headers: { "content-type": "audio/wav" } });
      }

      return new Response("mp3");
    });

    listen.mockReset();
    listen.mockResolvedValue({ data: { added: "none", heard: "living in" } });
  });

  it("replays the saved result without downloading or listening again", async () => {
    const { audit, id } = await wordToAudit(31);
    listen.mockResolvedValue({ data: { added: "speech", heard: "living in town" } });

    const first = await audit();
    const replay = await audit();

    expect(first).toMatchObject({
      entries: [{ added: "speech", heard: "living in town", id }],
      listened: 1,
      status: "ready",
    });

    expect(replay).toStrictEqual(first);
    expect(fetch).toHaveBeenCalledOnce();
    expect(listen).toHaveBeenCalledOnce();
  });

  it("reports a concurrent claim as unchecked while the first request listens", async () => {
    const { audit, id } = await wordToAudit(32);
    const finish = Promise.withResolvers<null>();

    listen.mockImplementationOnce(async () => {
      await finish.promise;
      return { data: { added: "none", heard: "living in" } };
    });

    const requests = [audit(), audit()];
    const unchecked = await Promise.race(requests).finally(() => finish.resolve(null));
    const results = await Promise.all(requests);
    const replay = await audit();

    expect(unchecked).toMatchObject({
      listened: 0,
      status: "ready",
      uncheckedEntries: [{ id, model: "Word" }],
    });

    expect(replay).toMatchObject({ entries: [], listened: 1, status: "ready" });
    expect(results).toContainEqual(replay);
    expect(fetch).toHaveBeenCalledOnce();
    expect(listen).toHaveBeenCalledOnce();
  });

  it("listens to a replacement recording on the same word", async () => {
    const { audit, id } = await wordToAudit(33);
    listen.mockResolvedValueOnce({ data: { added: "speech", heard: "living in town" } });

    await expect(audit()).resolves.toMatchObject({ flagged: 1, status: "ready" });

    await prisma.word.update({ data: { audioUrl: clipUrl(34) }, where: { id } });

    await expect(audit()).resolves.toMatchObject({ flagged: 0, listened: 1, status: "ready" });
    expect(listen).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenLastCalledWith(clipUrl(34), expect.any(Object));
  });

  it("retries a failed listen on the next request", async () => {
    const { audit, id } = await wordToAudit(35);
    listen.mockRejectedValueOnce(new Error("Provider unavailable"));

    await expect(audit()).resolves.toMatchObject({
      listened: 0,
      status: "ready",
      uncheckedEntries: [{ id, reason: "Listen failed." }],
    });

    await expect(audit()).resolves.toMatchObject({ listened: 1, status: "ready", unchecked: 0 });
    expect(listen).toHaveBeenCalledTimes(2);
  });

  it("reclaims an expired audit and saves its verdict", async () => {
    const { audit, id } = await wordToAudit(36);
    const recording = { audioUrl: clipUrl(36), clipId: id, unit: "word" } as const;

    await prisma.clipEndingAudit.create({ data: { ...recording, claimExpiresAt: new Date(0) } });

    await expect(audit()).resolves.toMatchObject({ listened: 1, status: "ready", unchecked: 0 });
    expect(listen).toHaveBeenCalledOnce();

    await expect(
      prisma.clipEndingAudit.findUnique({ where: { recording } }),
    ).resolves.toMatchObject({ added: "none", heard: "living in" });
  });

  it("pages by ID, includes legacy timestamps, and skips only waiting fixes targeting audio", async () => {
    const { id: organizationId } = await organizationFixture();

    await prisma.word.createMany({
      data: [
        { audioGeneratedAt: old, audioUrl: clipUrl(1), id: clipId(1), word: "living in" },
        { audioUrl: clipUrl(2), id: clipId(2), word: "sitting in" },
        { id: clipId(3), word: "no clip" },
        {
          audioGeneratedAt: new Date(cutoff),
          audioUrl: clipUrl(4),
          id: clipId(4),
          word: "new clip",
        },
        { audioUrl: clipUrl(5), id: clipId(5), word: "working in" },
        { audioUrl: clipUrl(6), id: clipId(6), word: "staying in" },
      ].map((word) => ({ ...word, organizationId, targetLanguage: "en" })),
    });

    await Promise.all([
      priorFix({ id: clipId(1), revoice: true, status: "proposed" }),
      priorFix({ id: clipId(2), revoice: false, status: "approved" }),
      priorFix({ id: clipId(5), revoice: true, status: "approved" }),
      priorFix({ id: clipId(6), revoice: true, status: "applied" }),
    ]);

    const input = { kind: "words", limit: 2, voicedBefore: cutoff };
    const first = await auditStoredClips({ input: { ...input, after: cursor } });

    expect(first).toMatchObject({
      entries: [],
      fixes: [],
      flagged: 0,
      listened: 1,
      next: clipId(2),
      skipped: 1,
      unchecked: 0,
      uncheckedEntries: [],
    });

    expect(listen).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ text: "sitting in" }));

    const second = await auditStoredClips({ input: { ...input, after: clipId(2) } });

    expect(second).toMatchObject({
      entries: [],
      fixes: [],
      flagged: 0,
      listened: 1,
      next: null,
      skipped: 1,
      unchecked: 0,
      uncheckedEntries: [],
    });

    expect(listen).toHaveBeenLastCalledWith(expect.objectContaining({ text: "staying in" }));
    expect(listen).toHaveBeenCalledTimes(2);
  });

  it("listens once with the audit model and identifies every unchecked clip", async () => {
    const { id: organizationId } = await organizationFixture();
    const logError = vi.spyOn(logger, "logError");

    await prisma.sentence.createMany({
      data: [
        { audioUrl: clipUrl(11), id: clipId(11), sentence: "Missing recording." },
        { audioUrl: clipUrl(12), id: clipId(12), sentence: "The listen fails." },
        { audioUrl: clipUrl(13), id: clipId(13), sentence: "Confirmed." },
        { audioUrl: clipUrl(14), id: clipId(14), sentence: "Clean." },
      ].map((sentence) => ({ ...sentence, organizationId, targetLanguage: "en" })),
    });

    listen.mockImplementation(async ({ text }) => {
      if (text === "The listen fails.") {
        throw new Error(text);
      }

      return {
        data:
          text === "Clean."
            ? { added: "none", heard: text }
            : { added: "sound", heard: `${text} [laugh]` },
      };
    });

    const result = await auditStoredClips({ input: { after: cursor, kind: "sentences" } });

    expect(result).toMatchObject({
      entries: [{ added: "sound", heard: "Confirmed. [laugh]", id: clipId(13), model: "Sentence" }],
      fixes: [{ changes: [{ id: clipId(13), model: "Sentence", revoice: true }] }],
      flagged: 1,
      listened: 2,
      next: null,
      skipped: 0,
      unchecked: 2,
      uncheckedEntries: [
        { id: clipId(11), model: "Sentence", reason: "Download returned HTTP 404." },
        { id: clipId(12), model: "Sentence", reason: "Listen failed." },
      ],
    });

    expect(listen).toHaveBeenCalledTimes(3);

    const wavDownload = vi.mocked(fetch).mock.calls.find(([url]) => url === clipUrl(13));
    const wavListen = listen.mock.calls.find(([{ text }]) => text === "Confirmed.");

    expect(wavDownload?.[1]?.signal).toBeInstanceOf(AbortSignal);
    expect(wavListen?.[0].abortSignal).toBeInstanceOf(AbortSignal);
    expect(wavListen?.[0].abortSignal).not.toBe(wavDownload?.[1]?.signal);

    expect(listen).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaType: "audio/wav",
        model: "google/gemini-3.8-flash",
        serviceTier: undefined,
        text: "Confirmed.",
      }),
    );

    expect(logError).toHaveBeenCalledWith("staff.audit-clips.unchecked", {
      errorName: "Error",
      id: clipId(12),
      model: "Sentence",
      reason: "Listen failed.",
      statusCode: undefined,
    });

    expect(JSON.stringify(logError.mock.calls)).not.toContain("The listen fails.");
    logError.mockRestore();
  });

  it("only proposes supported voices and skips unchanged clips with a latest rejected revoice", async () => {
    const { id: organizationId } = await organizationFixture();

    await prisma.word.createMany({
      data: [
        { audioUrl: clipUrl(21), id: clipId(21), word: "Unchanged after rejection" },
        { audioUrl: clipUrl(22), id: clipId(22), word: "New clip after rejection" },
        { audioUrl: clipUrl(23), id: clipId(23), word: "Newer revoice was applied" },
        { audioUrl: clipUrl(24), id: clipId(24), targetLanguage: "zxx", word: "No voice" },
      ].map((word) => ({
        audioGeneratedAt: new Date(cutoff),
        organizationId,
        targetLanguage: "en",
        ...word,
      })),
    });

    await Promise.all([
      priorFix({
        beforeGeneratedAt: cutoff,
        beforeUrl: clipUrl(21),
        id: clipId(21),
        revoice: true,
        status: "rejected",
      }),
      priorFix({
        beforeGeneratedAt: old.toISOString(),
        beforeUrl: clipUrl(22),
        id: clipId(22),
        revoice: true,
        status: "rejected",
      }),
      priorFix({
        beforeGeneratedAt: cutoff,
        beforeUrl: clipUrl(23),
        createdAt: old,
        id: clipId(23),
        revoice: true,
        status: "rejected",
      }),
      priorFix({ beforeUrl: clipUrl(23), id: clipId(23), revoice: true, status: "applied" }),
    ]);

    listen.mockResolvedValue({ data: { added: "speech", heard: "Extra words" } });

    const result = await auditStoredClips({ input: { after: clipId(20), kind: "words" } });

    expect(result).toMatchObject({
      entries: [{ id: clipId(22) }, { id: clipId(23) }, { id: clipId(24) }],
      fixes: [
        { changes: [{ id: clipId(22), model: "Word", revoice: true }] },
        { changes: [{ id: clipId(23), model: "Word", revoice: true }] },
      ],
      listened: 3,
      skipped: 1,
      unchecked: 0,
    });

    expect(listen).toHaveBeenCalledTimes(3);
  });
});
