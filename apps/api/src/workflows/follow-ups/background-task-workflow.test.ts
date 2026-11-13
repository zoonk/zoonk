import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { generateLanguageAudio } from "@zoonk/ai/tasks/audio";
import { prisma } from "@zoonk/db";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { describe, expect, it, vi } from "vitest";
import { backgroundTaskWorkflow } from "./background-task-workflow";

const SPEECH_PROVENANCE = {
  generatedAt: "2026-11-13T12:00:00.000Z",
  latencyMs: 1,
  model: "openai/gpt-voice",
  promptVersion: "test",
  provider: "openai",
  requestedModel: "openai/gpt-voice",
  runId: "speech-run",
  usage: {},
};

/** A proposed fix renaming a word, waiting for the clip of its new text. */
async function owedWordFix() {
  const [organization, proposer] = await Promise.all([
    organizationFixture(),
    userFixture({ role: "admin" }),
  ]);

  const word = await wordFixture({ organizationId: organization.id, targetLanguage: "en" });

  const fix = await prisma.contentFix.create({
    data: {
      changes: [
        {
          clip: {
            after: null,
            before: {
              audioGeneratedAt: null,
              audioModel: null,
              audioPromptVersion: null,
              audioRunId: null,
              audioUrl: null,
            },
          },
          fields: [{ after: "rental", before: word.word, field: "word" }],
          id: word.id,
          model: "Word",
          op: "set",
        },
      ],
      effects: [],
      proposerClientId: "test",
      proposerId: proposer.id,
      reason: "Test fix",
      unit: "word",
      unitId: word.id,
      voiceOwedAt: new Date(),
    },
  });

  return { fix, proposer };
}

function voiceTask({ fixId, userId }: { fixId: string; userId: string }) {
  return backgroundTaskWorkflow({
    id: randomUUID(),
    input: { fixId },
    key: fixId,
    kind: "voiceContentFix",
    revision: 0,
    userId,
  });
}

describe("voicing a proposed word or sentence fix", () => {
  it("stores the clip of the fix's new text on the fix, ready for approval", async () => {
    const { fix, proposer } = await owedWordFix();

    vi.mocked(put).mockImplementation(async (pathname) => ({
      contentDisposition: "inline",
      contentType: "audio/mpeg",
      downloadUrl: `https://blob.test/${pathname}`,
      etag: "",
      pathname,
      url: `https://blob.test/${pathname}`,
    }));

    vi.mocked(generateLanguageAudio).mockResolvedValue({
      data: {
        audio: new Uint8Array([1, 2, 3]),
        durationMs: 900,
        format: "mp3",
        provenance: SPEECH_PROVENANCE,
      },
      error: null,
    });

    await voiceTask({ fixId: fix.id, userId: proposer.id });

    expect(vi.mocked(generateLanguageAudio)).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ language: "en", text: "rental" }),
    );

    await expect(
      prisma.contentFix.findUniqueOrThrow({ where: { id: fix.id } }),
    ).resolves.toMatchObject({
      voice: {
        provenance: { runId: SPEECH_PROVENANCE.runId },
        status: "voiced",
        text: "rental",
        url: expect.stringContaining("blob.test"),
      },
      voiceOwedAt: null,
    });
  });

  it("records a voice that failed every retry, so the fix can't be approved", async () => {
    const { fix, proposer } = await owedWordFix();

    vi.mocked(generateLanguageAudio).mockResolvedValue({
      data: null,
      error: new Error("Text-to-speech is unavailable"),
    });

    await voiceTask({ fixId: fix.id, userId: proposer.id });

    await expect(
      prisma.contentFix.findUniqueOrThrow({ where: { id: fix.id } }),
    ).resolves.toMatchObject({ voice: { status: "failed" }, voiceOwedAt: expect.any(Date) });
  });
});
