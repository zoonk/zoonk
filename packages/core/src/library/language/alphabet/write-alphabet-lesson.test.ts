import { generateLanguageAudio } from "@zoonk/ai/tasks/audio";
import { generateAlphabetLesson } from "@zoonk/ai/tasks/language/alphabet-lesson";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { storeBlobUploads } from "../../../_test-utils/blob-uploads";
import {
  type WriteAlphabetLessonResult,
  publishAlphabetLesson,
  voiceAlphabetClip,
  writeAlphabetLesson,
} from "./write-alphabet-lesson";

type Content = Awaited<ReturnType<typeof generateAlphabetLesson>>["data"];

const HANGUL: Content = {
  canDo: "Read and say five Hangul vowels and consonants",
  description: "Read the letters every Korean syllable block is built from.",
  intro: [{ text: "Letters stack into one block per syllable.", title: "Blocks, not a line" }],
  letters: [
    ["ㅏ", "a", "아"],
    ["ㅓ", "eo", " 어 "],
    ["ㄱ", "g/k", "가"],
    ["ㄴ", "n", "나"],
  ].map(([symbol = "", readingAid = "", audioText = ""]) => ({
    audioText,
    forms: [],
    ipa: `/${readingAid}/`,
    pronunciation: `Like ${readingAid}.`,
    readingAid,
    symbol,
  })),
  script: "Hangul",
  summary: ["Each block is one syllable.", "Plain consonants are soft and unaspirated."],
  title: "Your first Hangul",
};

function mockContent(data: Content) {
  vi.mocked(generateAlphabetLesson).mockResolvedValueOnce({
    data,
    provenance: {
      generatedAt: new Date().toISOString(),
      latencyMs: 1,
      model: "openai/gpt-6-luna",
      promptVersion: "test-prompt",
      provider: "openai",
      requestedModel: "openai/gpt-6-luna",
      runId: crypto.randomUUID(),
      usage: {},
    },
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });
}

function freshLearnerLanguage(): string {
  return `x${crypto.randomUUID().slice(0, 8)}`;
}

function expectWritten(written: WriteAlphabetLessonResult) {
  if (written.status !== "written") {
    throw new Error(`The alphabet lesson wasn't written: ${written.status}`);
  }

  return written;
}

async function writeAndPublish({
  learnerLanguage,
  targetLanguage,
}: {
  learnerLanguage: string;
  targetLanguage: string;
}) {
  const user = await userFixture();
  const workflowRunId = crypto.randomUUID();

  const written = expectWritten(
    await writeAlphabetLesson({ learnerLanguage, targetLanguage, workflowRunId }),
  );

  await expect(
    publishAlphabetLesson({ ...written, audioUrls: {}, userId: user.id, workflowRunId }),
  ).resolves.toBe(true);

  return written.lessonId;
}

describe(writeAlphabetLesson, () => {
  it("writes nothing for a Latin script", async () => {
    await expect(
      writeAlphabetLesson({
        learnerLanguage: "pt",
        targetLanguage: "es",
        workflowRunId: crypto.randomUUID(),
      }),
    ).resolves.toStrictEqual({ status: "notNeeded" });

    expect(generateAlphabetLesson).not.toHaveBeenCalled();
  });

  it("publishes one shared lesson per script and learner language with its clips, reused by later runs", async () => {
    const user = await userFixture();
    const learnerLanguage = freshLearnerLanguage();
    const workflowRunId = crypto.randomUUID();

    mockContent(HANGUL);

    const written = expectWritten(
      await writeAlphabetLesson({ learnerLanguage, targetLanguage: "ko-KR", workflowRunId }),
    );

    expect(written.clips).toStrictEqual(["아", "어", "가", "나"]);

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: written.lessonId } }),
    ).resolves.toMatchObject({ contentRunId: workflowRunId, contentStatus: "running" });

    await expect(
      publishAlphabetLesson({
        ...written,
        audioUrls: Object.fromEntries([["아", "https://blob.test/a.mp3"]]),
        userId: user.id,
        workflowRunId,
      }),
    ).resolves.toBe(true);

    const lesson = await prisma.lesson.findUniqueOrThrow({
      include: { steps: { orderBy: { position: "asc" } } },
      where: { id: written.lessonId },
    });

    expect(lesson).toMatchObject({
      canDo: HANGUL.canDo,
      contentStatus: "completed",
      identityKey: "alphabet:ko-Kore",
      language: learnerLanguage,
      model: "openai/gpt-6-luna",
      ownerId: null,
      targetLanguage: "ko-KR",
      title: HANGUL.title,
    });

    expect(lesson.steps.map((step) => step.kind)).toStrictEqual([
      "explanation",
      "alphabet",
      "alphabet",
      "alphabet",
      "alphabet",
      "matchColumns",
      "summary",
    ]);

    expect(lesson.steps[1]?.content).toMatchObject({
      audioUrl: "https://blob.test/a.mp3",
      symbol: "ㅏ",
    });

    expect(lesson.steps[2]?.content).toMatchObject({ audioUrl: null, symbol: "ㅓ" });

    await expect(
      writeAlphabetLesson({
        learnerLanguage,
        targetLanguage: "ko",
        workflowRunId: crypto.randomUUID(),
      }),
    ).resolves.toStrictEqual({ lessonId: lesson.id, status: "ready" });

    expect(generateAlphabetLesson).toHaveBeenCalledOnce();
  });

  it("owes the published version's review in the same write, and nothing when its claim was lost", async () => {
    const user = await userFixture();
    const learnerLanguage = freshLearnerLanguage();
    const workflowRunId = crypto.randomUUID();

    mockContent(HANGUL);

    const written = expectWritten(
      await writeAlphabetLesson({ learnerLanguage, targetLanguage: "ru", workflowRunId }),
    );

    const publish = { ...written, audioUrls: {}, userId: user.id };

    await expect(
      publishAlphabetLesson({ ...publish, workflowRunId: crypto.randomUUID() }),
    ).resolves.toBe(false);

    await expect(prisma.followUp.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(publishAlphabetLesson({ ...publish, workflowRunId })).resolves.toBe(true);

    await expect(prisma.followUp.findMany({ where: { userId: user.id } })).resolves.toMatchObject([
      {
        input: { lessonId: written.lessonId, version: 1 },
        key: `${written.lessonId}:1`,
        kind: "reviewAlphabetLesson",
      },
    ]);
  });

  it("holds back a draft without letters so a later run writes it again", async () => {
    const learnerLanguage = freshLearnerLanguage();
    mockContent({ ...HANGUL, letters: [] });

    const held = await writeAlphabetLesson({
      learnerLanguage,
      targetLanguage: "ru",
      workflowRunId: crypto.randomUUID(),
    });

    expect(held.status).toBe("heldBack");

    const lessonId = "lessonId" in held ? held.lessonId : "";

    await expect(
      prisma.lesson.findUniqueOrThrow({ include: { steps: true }, where: { id: lessonId } }),
    ).resolves.toMatchObject({ contentStatus: "failed", steps: [] });

    mockContent(HANGUL);

    await expect(writeAndPublish({ learnerLanguage, targetLanguage: "ru" })).resolves.toBe(
      lessonId,
    );
  });

  it("frees the claim when writing fails, so a retry or the pair's next learner writes it", async () => {
    const learnerLanguage = freshLearnerLanguage();
    vi.mocked(generateAlphabetLesson).mockRejectedValueOnce(new Error("Provider down"));

    await expect(
      writeAlphabetLesson({
        learnerLanguage,
        targetLanguage: "ja",
        workflowRunId: crypto.randomUUID(),
      }),
    ).rejects.toThrow("Provider down");

    const lesson = await prisma.lesson.findUniqueOrThrow({
      where: { languageIdentity: { identityKey: "alphabet:ja-Jpan", language: learnerLanguage } },
    });

    expect(lesson.contentStatus).toBe("failed");
    mockContent(HANGUL);

    await expect(writeAndPublish({ learnerLanguage, targetLanguage: "ja" })).resolves.toBe(
      lesson.id,
    );
  });
});

describe(voiceAlphabetClip, () => {
  it("throws when the clip can't be voiced, so its step retries it", async () => {
    storeBlobUploads();

    vi.mocked(generateLanguageAudio).mockResolvedValueOnce({
      data: null,
      error: new Error("TTS failed"),
    });

    await expect(voiceAlphabetClip({ targetLanguage: "ko", text: "아" })).rejects.toThrow(
      "TTS failed",
    );
  });
});
