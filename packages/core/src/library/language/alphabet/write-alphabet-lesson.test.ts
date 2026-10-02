import { generateAlphabetLesson } from "@zoonk/ai/tasks/v2/language/alphabet-lesson";
import { prisma } from "@zoonk/db";
import { describe, expect, it, vi } from "vitest";
import { generateLanguageAudio } from "../../../audio/generate-language-audio";
import { writeAlphabetLesson } from "./write-alphabet-lesson";

// The writer and text-to-speech (with its upload) are paid external services.
vi.mock("@zoonk/ai/tasks/v2/language/alphabet-lesson", () => ({ generateAlphabetLesson: vi.fn() }));
vi.mock("../../../audio/generate-language-audio", () => ({ generateLanguageAudio: vi.fn() }));

type Content = Awaited<ReturnType<typeof generateAlphabetLesson>>["data"];

const HANGUL: Content = {
  canDo: "Read and say five Hangul vowels and consonants",
  description: "Read the letters every Korean syllable block is built from.",
  intro: [{ text: "Letters stack into one block per syllable.", title: "Blocks, not a line" }],
  letters: [
    ["ㅏ", "a", "아"],
    ["ㅓ", "eo", "어"],
    ["ㄱ", "g/k", "가"],
    ["ㄴ", "n", "나"],
  ].map(([symbol = "", readingAid = "", audioText = ""]) => ({
    audioText,
    forms: [],
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

/** Voices every clip except the one for `failing`, which leaves its card without audio. */
function mockAudio({ failing }: { failing?: string } = {}) {
  vi.mocked(generateLanguageAudio).mockImplementation(async ({ text }) =>
    text === failing
      ? { data: null, error: new Error("TTS failed") }
      : {
          data: {
            provenance: {
              generatedAt: new Date().toISOString(),
              model: "google/gemini-2.5-flash-preview-tts",
              promptVersion: "speech-v1",
              runId: "speech-run",
            },
            url: `https://blob.test/audio/${encodeURIComponent(text)}.mp3`,
          },
          error: null,
        },
  );
}

/**
 * Alphabet lessons are shared per learner language, so each test uses a made-up language code (the
 * writer only stores it) to own its lesson.
 */
function freshLearnerLanguage(): string {
  return `x${crypto.randomUUID().slice(0, 8)}`;
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

  it("publishes one shared lesson per script and learner language, reused by later runs", async () => {
    const learnerLanguage = freshLearnerLanguage();
    mockContent(HANGUL);
    mockAudio({ failing: "어" });

    const written = await writeAlphabetLesson({
      learnerLanguage,
      targetLanguage: "ko-KR",
      workflowRunId: crypto.randomUUID(),
    });

    expect(written.status).toBe("published");

    const lesson = await prisma.lesson.findUniqueOrThrow({
      include: { steps: { orderBy: { position: "asc" } } },
      where: { id: "lessonId" in written ? written.lessonId : "" },
    });

    expect(lesson).toMatchObject({
      canDo: HANGUL.canDo,
      contentStatus: "completed",
      identityKey: "alphabet:ko",
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
      audioUrl: "https://blob.test/audio/%EC%95%84.mp3",
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

  it("holds back a draft without letters so a later run writes it again", async () => {
    const learnerLanguage = freshLearnerLanguage();
    mockContent({ ...HANGUL, letters: [] });
    mockAudio();

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

    await expect(
      writeAlphabetLesson({
        learnerLanguage,
        targetLanguage: "ru",
        workflowRunId: crypto.randomUUID(),
      }),
    ).resolves.toStrictEqual({ lessonId, status: "published" });
  });

  it("frees the claim when writing fails, so a retry or the pair's next learner writes it", async () => {
    const learnerLanguage = freshLearnerLanguage();
    vi.mocked(generateAlphabetLesson).mockRejectedValueOnce(new Error("Provider down"));
    mockAudio();

    await expect(
      writeAlphabetLesson({
        learnerLanguage,
        targetLanguage: "ja",
        workflowRunId: crypto.randomUUID(),
      }),
    ).rejects.toThrow("Provider down");

    const lesson = await prisma.lesson.findUniqueOrThrow({
      where: { languageIdentity: { identityKey: "alphabet:ja", language: learnerLanguage } },
    });

    expect(lesson.contentStatus).toBe("failed");
    mockContent(HANGUL);

    await expect(
      writeAlphabetLesson({
        learnerLanguage,
        targetLanguage: "ja",
        workflowRunId: crypto.randomUUID(),
      }),
    ).resolves.toStrictEqual({ lessonId: lesson.id, status: "published" });
  });
});
