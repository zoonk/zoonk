import { generateLanguageAudio } from "@zoonk/ai/tasks/audio";
import { prisma } from "@zoonk/db";
import { languageLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { describe, expect, it, vi } from "vitest";
import { storeBlobUploads } from "../../_test-utils/blob-uploads";
import { listOwed } from "../../_test-utils/follow-ups";
import {
  approve,
  optionsFor,
  proposeFix,
  revertFix,
  signInApprover,
  signInProposer,
} from "./_test-utils/content-fix-steps";
import { proposeContentFix } from "./propose-content-fix";
import { failContentFixVoice, voiceContentFix } from "./voice-content-fix";

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

function mockVoice() {
  storeBlobUploads();

  vi.mocked(generateLanguageAudio).mockResolvedValue({
    data: {
      audio: new Uint8Array([1, 2, 3]),
      durationMs: 900,
      format: "mp3",
      provenance: SPEECH_PROVENANCE,
    },
    error: null,
  });
}

/** Proposes a fix, records its clip as the API workflow would, and approves it. */
async function proposeVoiceAndApprove(input: unknown) {
  await signInProposer();
  const fix = await proposeFix(input);

  mockVoice();
  await voiceContentFix({ fixId: fix.id });

  const { key } = await signInApprover();
  const decision = await approve({ fixId: fix.id, key });

  return { decision, fix };
}

function spokenStep(steps: readonly { id: string; kind: string }[]) {
  const step = steps.find((candidate) => candidate.kind === "spokenAnswer");

  if (!step) {
    throw new Error("Expected a spoken screen");
  }

  return step;
}

describe("word and sentence fixes", () => {
  it("voices a word's new text before approval, then writes the text and its clip together", async () => {
    const { lesson, word } = await languageLessonFixture();
    const proposer = await signInProposer();

    const fix = await proposeFix({
      changes: [{ id: word.id, model: "Word", set: { word: " rental " } }],
      reason: "The lesson teaches the noun for a rented place.",
    });

    expect(fix).toMatchObject({
      changes: [
        {
          fields: [{ after: "rental", before: "rent", field: "word" }],
          id: word.id,
          model: "Word",
          op: "set",
        },
      ],
      unit: "word",
      voice: null,
      voiceOwed: true,
    });

    expect(fix.effects).toStrictEqual(
      expect.arrayContaining([
        { id: word.id, kind: "voiceOwed", model: "Word" },
        { kind: "lessonsUpdated", lessonIds: expect.arrayContaining([lesson.id]) },
        { count: 1, kind: "pronunciationsKept", wordId: word.id },
      ]),
    );

    await expect(listOwed(proposer.id)).resolves.toStrictEqual([
      { input: { fixId: fix.id }, key: fix.id, kind: "voiceContentFix" },
    ]);

    await signInApprover();
    await expect(optionsFor(fix.id)).resolves.toStrictEqual({ status: "changed" });

    mockVoice();
    await voiceContentFix({ fixId: fix.id });

    const voiced = await prisma.contentFix.findUniqueOrThrow({ where: { id: fix.id } });

    expect(voiced).toMatchObject({
      voice: { status: "voiced", text: "rental", url: expect.stringContaining("blob.test") },
      voiceOwedAt: null,
    });

    const { key } = await signInApprover();

    await expect(approve({ fixId: fix.id, key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });

    await expect(prisma.word.findUniqueOrThrow({ where: { id: word.id } })).resolves.toMatchObject({
      audioRunId: SPEECH_PROVENANCE.runId,
      audioUrl: (voiced.voice as { url: string }).url,
      word: "rental",
    });

    const fixedLesson = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });
    expect(fixedLesson.updatedAt.getTime()).toBeGreaterThan(lesson.updatedAt.getTime());
  });

  it("keeps a fix that couldn't be voiced unapprovable", async () => {
    const { word } = await languageLessonFixture();
    await signInProposer();

    const fix = await proposeFix({
      changes: [{ id: word.id, model: "Word", revoice: true }],
      reason: "The clip says another word.",
    });

    expect(fix).toMatchObject({ changes: [{ op: "revoice", text: "rent" }], voiceOwed: true });

    await failContentFixVoice({ fixId: fix.id });

    await expect(
      prisma.contentFix.findUniqueOrThrow({ where: { id: fix.id } }),
    ).resolves.toMatchObject({ voice: { status: "failed" }, voiceOwedAt: expect.any(Date) });

    await signInApprover();
    await expect(optionsFor(fix.id)).resolves.toStrictEqual({ status: "changed" });
  });

  it("re-records a clip whose text is right", async () => {
    const { word } = await languageLessonFixture();

    const { decision } = await proposeVoiceAndApprove({
      changes: [{ id: word.id, model: "Word", revoice: true }],
      reason: "The clip says another word.",
    });

    expect(decision).toMatchObject({ fix: { status: "applied" } });

    await expect(prisma.word.findUniqueOrThrow({ where: { id: word.id } })).resolves.toMatchObject({
      audioUrl: expect.stringContaining("blob.test"),
      word: "rent",
    });
  });

  it("puts the original clip back when a re-recording is reverted", async () => {
    const { word } = await languageLessonFixture();

    const original = {
      audioGeneratedAt: new Date("2026-01-01T00:00:00.000Z"),
      audioModel: "old-voice",
      audioPromptVersion: "v1",
      audioRunId: "old-run",
      audioUrl: "https://blob.test/original-rent.mp3",
    };

    await prisma.word.update({ data: original, where: { id: word.id } });

    const { fix } = await proposeVoiceAndApprove({
      changes: [{ id: word.id, model: "Word", revoice: true }],
      reason: "The clip says another word.",
    });

    await signInProposer();
    const revert = await revertFix({ fixId: fix.id, reason: "The old clip was right." });

    if (revert.status !== "proposed") {
      throw new Error(`Expected a revert, got ${revert.status}`);
    }

    expect(revert.fix).toMatchObject({ voiceOwed: false });

    const { key } = await signInApprover();

    await expect(approve({ fixId: revert.fix.id, key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });

    await expect(prisma.word.findUniqueOrThrow({ where: { id: word.id } })).resolves.toMatchObject(
      original,
    );
  });

  it("goes stale when the clip changed after a re-recording was proposed", async () => {
    const { word } = await languageLessonFixture();
    await signInProposer();

    const fix = await proposeFix({
      changes: [{ id: word.id, model: "Word", revoice: true }],
      reason: "The clip says another word.",
    });

    mockVoice();
    await voiceContentFix({ fixId: fix.id });

    await prisma.word.update({
      data: { audioUrl: "https://blob.test/newer-rent.mp3" },
      where: { id: word.id },
    });

    const { key } = await signInApprover();

    await expect(approve({ fixId: fix.id, key })).resolves.toMatchObject({
      fix: { status: "stale" },
    });

    await expect(prisma.word.findUniqueOrThrow({ where: { id: word.id } })).resolves.toMatchObject({
      audioUrl: "https://blob.test/newer-rent.mp3",
    });
  });

  it("refuses new text another row of the language already holds, naming it", async () => {
    const { sentence, word } = await languageLessonFixture();

    const [otherWord, otherSentence] = await Promise.all([
      wordFixture({ organizationId: word.organizationId, targetLanguage: "en", word: "deposit" }),
      prisma.sentence.create({
        data: {
          organizationId: sentence.organizationId,
          sentence: "Is the deposit refundable?",
          targetLanguage: "en",
        },
      }),
    ]);

    await signInProposer();

    const result = await proposeContentFix({
      fixes: [
        { changes: [{ id: word.id, model: "Word", set: { word: "deposit" } }] },
        {
          changes: [
            { id: sentence.id, model: "Sentence", set: { sentence: otherSentence.sentence } },
          ],
        },
      ],
      reason: "Typo.",
    });

    expect(result).toMatchObject({ status: "invalid" });
    expect(result).toHaveProperty("message", expect.stringContaining(`Word ${otherWord.id}`));

    expect(result).toHaveProperty(
      "message",
      expect.stringContaining(`Sentence ${otherSentence.id}`),
    );
  });

  it("keeps a word-bank tile's text, and fixes its romanization without a clip", async () => {
    const { word } = await languageLessonFixture();
    const tile = await wordFixture({ organizationId: word.organizationId, targetLanguage: "ja" });

    await signInProposer();

    await expect(
      proposeContentFix({
        changes: [{ id: tile.id, model: "Word", set: { word: "家賃" } }],
        reason: "Typo.",
      }),
    ).resolves.toMatchObject({
      message: expect.stringContaining("word-bank tile"),
      status: "invalid",
    });

    await expect(
      proposeFix({
        changes: [{ id: tile.id, model: "Word", set: { romanization: "yachin" } }],
        reason: "Missing romanization.",
      }),
    ).resolves.toMatchObject({ effects: [], voiceOwed: false });
  });

  it("copies a sentence fix to spoken screens and owes word orders again, and its revert puts both back", async () => {
    const { lesson, sentence, steps } = await languageLessonFixture();
    const spoken = spokenStep(steps);
    const fixedText = "How much is the monthly rent?";

    await Promise.all([
      prisma.lessonSentence.update({
        data: { ordersOwedAt: null, otherSentenceOrders: ["the rent How much is?"] },
        where: { lessonId_sentenceId: { lessonId: lesson.id, sentenceId: sentence.id } },
      }),
      prisma.lesson.update({ data: { sentenceOrdersAttempts: 3 }, where: { id: lesson.id } }),
    ]);

    const { decision, fix } = await proposeVoiceAndApprove({
      changes: [{ id: sentence.id, model: "Sentence", set: { sentence: fixedText } }],
      reason: "The lesson is about monthly rent.",
    });

    expect(fix.effects).toStrictEqual(
      expect.arrayContaining([
        { kind: "spokenScreensCopied", stepIds: [spoken.id] },
        { kind: "sentenceOrdersOwed", lessonIds: [lesson.id] },
      ]),
    );

    expect(decision).toMatchObject({ fix: { status: "applied" } });

    const readFixed = () =>
      Promise.all([
        prisma.step.findUniqueOrThrow({ where: { id: spoken.id } }),
        prisma.lessonSentence.findUniqueOrThrow({
          where: { lessonId_sentenceId: { lessonId: lesson.id, sentenceId: sentence.id } },
        }),
        prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
      ]);

    const [step, link, fixedLesson] = await readFixed();

    expect(step.content).toMatchObject({ targetText: fixedText, translation: link.translation });
    expect(link).toMatchObject({ ordersOwedAt: expect.any(Date), otherSentenceOrders: [] });
    expect(fixedLesson.sentenceOrdersAttempts).toBe(0);

    const approver = await prisma.contentFix.findUniqueOrThrow({ where: { id: fix.id } });

    await expect(listOwed(approver.deciderId ?? "")).resolves.toStrictEqual([
      { input: { lessonId: lesson.id }, key: lesson.id, kind: "writeSentenceOrders" },
    ]);

    await prisma.lessonSentence.update({
      data: { ordersOwedAt: null, otherSentenceOrders: ["monthly rent How much is the?"] },
      where: { lessonId_sentenceId: { lessonId: lesson.id, sentenceId: sentence.id } },
    });

    await signInProposer();
    const revert = await revertFix({ fixId: fix.id, reason: "Put it back." });

    if (revert.status !== "proposed") {
      throw new Error(`Expected a revert, got ${revert.status}`);
    }

    mockVoice();
    await voiceContentFix({ fixId: revert.fix.id });
    const { key } = await signInApprover();

    await expect(approve({ fixId: revert.fix.id, key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });

    const [revertedStep, revertedLink] = await readFixed();

    expect(revertedStep.content).toMatchObject({ targetText: sentence.sentence });
    expect(revertedLink).toMatchObject({ ordersOwedAt: expect.any(Date), otherSentenceOrders: [] });
  });

  it("fixes one lesson's rows of a word and a sentence by their key", async () => {
    const { lesson, sentence, steps, word } = await languageLessonFixture();
    const spoken = spokenStep(steps);
    await signInProposer();

    await expect(
      proposeContentFix({
        changes: [
          {
            id: { lessonId: lesson.id, wordId: sentence.id },
            model: "LessonWord",
            set: { translation: "renda" },
          },
        ],
        reason: "Typo.",
      }),
    ).resolves.toMatchObject({
      message: expect.stringContaining(`No LessonWord with lessonId ${lesson.id}`),
      status: "invalid",
    });

    const result = await proposeContentFix({
      fixes: [
        {
          changes: [
            {
              id: { lessonId: lesson.id, wordId: word.id },
              model: "LessonWord",
              set: { distractors: ["deposit", "bill", "fee"], translation: "o aluguel" },
            },
          ],
        },
        {
          changes: [
            {
              id: { lessonId: lesson.id, sentenceId: sentence.id },
              model: "LessonSentence",
              set: { translation: "Quanto custa o aluguel?" },
            },
          ],
        },
      ],
      reason: "Clearer translations.",
    });

    if (result.status !== "proposed") {
      throw new Error(`Expected a proposal, got ${JSON.stringify(result)}`);
    }

    const [wordFix, sentenceFix] = result.fixes;

    expect(wordFix).toMatchObject({
      changes: [{ id: word.id, lessonId: lesson.id, model: "LessonWord" }],
      unit: "word",
      voiceOwed: false,
    });

    expect(sentenceFix?.effects).toStrictEqual(
      expect.arrayContaining([
        { kind: "spokenScreensCopied", stepIds: [spoken.id] },
        { kind: "sentenceOrdersOwed", lessonIds: [lesson.id] },
      ]),
    );

    const { key } = await signInApprover();

    for (const fix of result.fixes) {
      // oxlint-disable-next-line no-await-in-loop -- each fix has its own approval
      await expect(approve({ fixId: fix.id, key })).resolves.toMatchObject({
        fix: { status: "applied" },
      });
    }

    await expect(
      prisma.lessonWord.findUniqueOrThrow({
        where: { lessonId_wordId: { lessonId: lesson.id, wordId: word.id } },
      }),
    ).resolves.toMatchObject({ distractors: ["deposit", "bill", "fee"], translation: "o aluguel" });

    await expect(
      prisma.step.findUniqueOrThrow({ where: { id: spoken.id } }),
    ).resolves.toMatchObject({ content: { translation: "Quanto custa o aluguel?" } });
  });
});
