import { checkClipEnding } from "@zoonk/ai/tasks/audio/check-clip-ending";
import { STAFF_READ_SCOPE } from "@zoonk/auth/cli-login-contract";
import { prisma } from "@zoonk/db";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { headers } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cliTokenFixture } from "../../../auth/src/_test-utils/cli-tokens";
import { getSpeechClipKey } from "../audio/speech-clip-key";
import { auditStoredClips } from "./audit-clips";

// Use the real staff login and database without calling the paid listening model.
vi.mock("@zoonk/ai/tasks/audio/check-clip-ending", () => ({ checkClipEnding: vi.fn() }));

const listen = vi.mocked(checkClipEnding, { partial: true });
const cutoff = "2026-11-27T12:00:00.000Z";
const old = new Date("2026-11-26T12:00:00.000Z");
const cursor = "ffffffff-ffff-4fff-8fff-000000000000";

function clipId(number: number) {
  return `ffffffff-ffff-4fff-8fff-${String(number).padStart(12, "0")}`;
}

function clipUrl(number: number) {
  return `https://example.test/${String(number)}.mp3`;
}

function waitingFix({
  id,
  status,
  revoice,
}: {
  id: string;
  status: "proposed" | "approved" | "applied";
  revoice: boolean;
}) {
  const change = revoice
    ? {
        before: {
          audioGeneratedAt: null,
          audioModel: null,
          audioPromptVersion: null,
          audioRunId: null,
          audioUrl: clipUrl(1),
        },
        op: "revoice",
        text: "living in",
      }
    : { fields: [{ after: "líving in", before: null, field: "romanization" }], op: "set" };

  return prisma.contentFix.create({
    data: {
      batchId: crypto.randomUUID(),
      changes: [{ ...change, id, model: "Word" }],
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
      waitingFix({ id: clipId(1), revoice: true, status: "proposed" }),
      waitingFix({ id: clipId(2), revoice: false, status: "approved" }),
      waitingFix({ id: clipId(5), revoice: true, status: "approved" }),
      waitingFix({ id: clipId(6), revoice: true, status: "applied" }),
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
    });

    expect(listen).toHaveBeenLastCalledWith(expect.objectContaining({ text: "staying in" }));
    expect(listen).toHaveBeenCalledTimes(2);
  });

  it("confirms additions twice and counts failed downloads or listens as unchecked", async () => {
    const { id: organizationId } = await organizationFixture();

    await prisma.sentence.createMany({
      data: [
        { audioUrl: clipUrl(11), id: clipId(11), sentence: "Missing recording." },
        { audioUrl: clipUrl(12), id: clipId(12), sentence: "First listen fails." },
        { audioUrl: clipUrl(13), id: clipId(13), sentence: "Confirmed." },
        { audioUrl: clipUrl(14), id: clipId(14), sentence: "Cleared." },
        { audioUrl: clipUrl(15), id: clipId(15), sentence: "Confirmation fails." },
      ].map((sentence) => ({ ...sentence, organizationId, targetLanguage: "en" })),
    });

    const firstChecks = new Set<string>();

    listen.mockImplementation(async ({ text }) => {
      const confirming = firstChecks.has(text);
      firstChecks.add(text);

      if (text === "First listen fails." || (confirming && text === "Confirmation fails.")) {
        throw new Error("Model unavailable");
      }

      return {
        data:
          confirming && text === "Cleared."
            ? { added: "none", heard: text }
            : { added: "sound", heard: `${text} [laugh]` },
      };
    });

    const result = await auditStoredClips({ input: { after: cursor, kind: "sentences" } });

    expect(result).toMatchObject({
      entries: [
        {
          added: "sound",
          heard: "Confirmed. [laugh]",
          id: clipId(13),
          language: "en",
          model: "Sentence",
          text: "Confirmed.",
        },
      ],
      fixes: [{ changes: [{ id: clipId(13), model: "Sentence", revoice: true }] }],
      flagged: 1,
      listened: 2,
      next: null,
      skipped: 0,
      unchecked: 3,
    });

    expect(listen).toHaveBeenCalledTimes(7);

    expect(listen).toHaveBeenCalledWith(
      expect.objectContaining({ mediaType: "audio/wav", serviceTier: "flex", text: "Confirmed." }),
    );
  });

  it("only audits public ownerless speech assets voiced before the cutoff", async () => {
    const user = await userFixture();

    const assets = [
      { id: clipId(21), prompt: "Shared clip" },
      { id: clipId(22), prompt: "Listening recording", reuseKey: "listening:en:recording" },
      { id: clipId(23), ownerId: user.id, prompt: "Owner clip" },
      { id: clipId(24), prompt: "Private clip", visibility: "private" as const },
      { generatedAt: new Date(cutoff), id: clipId(25), prompt: "New clip" },
    ];

    await Promise.all(
      assets.map((asset) =>
        mediaAssetFixture({
          generatedAt: old,
          kind: "audio",
          language: "en",
          mimeType: "audio/mpeg",
          reuseKey: getSpeechClipKey({ language: "en", text: asset.prompt }),
          url: clipUrl(21),
          ...asset,
        }),
      ),
    );

    listen.mockResolvedValue({ data: { added: "speech", heard: "Shared clip, and more" } });

    const result = await auditStoredClips({
      input: { after: cursor, kind: "speech", voicedBefore: cutoff },
    });

    expect(result).toMatchObject({
      entries: [
        {
          added: "speech",
          heard: "Shared clip, and more",
          id: clipId(21),
          language: "en",
          model: "MediaAsset",
          text: "Shared clip",
        },
      ],
      flagged: 1,
      listened: 1,
      next: null,
      skipped: 0,
      unchecked: 0,
    });

    expect(result).not.toHaveProperty("fixes");
    expect(listen).toHaveBeenCalledTimes(2);
  });
});
