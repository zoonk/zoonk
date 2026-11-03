import { randomUUID } from "node:crypto";
import { generateLanguageAudio } from "@zoonk/ai/tasks/audio";
import {
  type AlphabetLessonContent,
  fixAlphabetLesson,
  generateAlphabetLesson,
} from "@zoonk/ai/tasks/language/alphabet-lesson";
import { checkLessonQuality } from "@zoonk/ai/tasks/quality/lesson-check";
import {
  publishAlphabetLesson,
  writeAlphabetLesson,
} from "@zoonk/core/library/language/write-alphabet-lesson";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { taskResult } from "../_test-utils/recorded-outputs";
import { followUpsWorkflow } from "../follow-ups/follow-ups-workflow";
import { alphabetReviewWorkflow } from "./alphabet-review-workflow";

vi.mock("@zoonk/ai/tasks/audio", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateLanguageAudio: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/language/alphabet-lesson", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fixAlphabetLesson: vi.fn(),
  generateAlphabetLesson: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/quality/lesson-check", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  checkLessonQuality: vi.fn(),
}));

// Steps upload to Vercel Blob, which has no store in tests.
vi.mock("@vercel/blob", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  put: vi.fn(async (pathname: string) => ({
    pathname,
    url: `https://blob.test/${randomUUID()}/${pathname}`,
  })),
}));

const WAIT = { interval: 200, timeout: 30_000 };

const CYRILLIC: AlphabetLessonContent = {
  canDo: "Leia e pronuncie в, х e к.",
  description: "Suas primeiras letras russas.",
  intro: [{ text: "Leia da esquerda para a direita.", title: "Direção" }],
  letters: [
    ["в", "v", "ва", "Como o v de “vida”; ouça ва (va)."],
    ["х", "kh", "ха", "Mais atrás que o h de “hora”; ouça ха (kha)."],
    ["к", "k", "ка", "Como o c de “casa”; ouça ка (ka)."],
  ].map(([symbol = "", readingAid = "", audioText = "", pronunciation = ""]) => ({
    audioText,
    forms: [],
    ipa: "/x/",
    pronunciation,
    readingAid,
    symbol,
  })),
  script: "Cirílico",
  summary: ["Leia uma letra por vez."],
  title: "Primeiras letras russas",
};

function voiced(): Awaited<ReturnType<typeof generateLanguageAudio>> {
  return {
    data: {
      audio: new Uint8Array([1, 2, 3]),
      durationMs: 900,
      format: "mp3",
      provenance: taskResult(null, "google/gemini-3.8-flash-tts").provenance,
    },
    error: null,
  };
}

function review(screens: number[]) {
  return taskResult({
    issues: screens.map((screen) => ({
      fix: "Use a sound the learner knows.",
      kind: "incorrect" as const,
      problem: "The cue compares it with a sound it doesn't have.",
      screen,
      severity: "blocking" as const,
    })),
  });
}

async function publishCyrillic() {
  const user = await userFixture();
  const workflowRunId = randomUUID();

  vi.mocked(generateAlphabetLesson).mockResolvedValueOnce(
    taskResult(CYRILLIC, "openai/gpt-6-luna"),
  );

  const written = await writeAlphabetLesson({
    learnerLanguage: `x${randomUUID().slice(0, 8)}`,
    targetLanguage: "ru",
    workflowRunId,
  });

  if (written.status !== "written") {
    throw new Error(`The alphabet lesson wasn't written: ${written.status}`);
  }

  await publishAlphabetLesson({
    ...written,
    audioUrls: Object.fromEntries(written.clips.map((text) => [text, `https://blob.test/${text}`])),
    userId: user.id,
    workflowRunId,
  });

  return { lessonId: written.lessonId, userId: user.id };
}

describe(alphabetReviewWorkflow, () => {
  beforeEach(() => {
    vi.mocked(checkLessonQuality).mockReset();
    vi.mocked(fixAlphabetLesson).mockReset();
    vi.mocked(generateLanguageAudio).mockReset().mockResolvedValue(voiced());
  });

  it("runs the review a published lesson owes from its learner's follow-ups", async () => {
    const { lessonId, userId } = await publishCyrillic();
    vi.mocked(checkLessonQuality).mockResolvedValue(review([]));

    const run = await start(followUpsWorkflow, [{ userId }]);
    await expect(run.returnValue).resolves.toStrictEqual({ status: "done" });

    await vi.waitFor(() => {
      expect(checkLessonQuality).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          alphabet: true,
          analytics: expect.objectContaining({ contentScope: "shared", distinctId: userId }),
          lesson: expect.objectContaining({
            summary: { ideas: [{ text: "Leia uma letra por vez." }], shape: "hub" },
          }),
        }),
      );
    }, WAIT);

    await expect(prisma.followUp.count({ where: { userId } })).resolves.toBe(0);

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } }),
    ).resolves.toMatchObject({ contentStatus: "completed" });
  });

  it("voices each new clip of a fix in its own step, retrying only the one that failed", async () => {
    const { lessonId } = await publishCyrillic();
    vi.mocked(checkLessonQuality).mockResolvedValue(review([2, 3]));

    vi.mocked(fixAlphabetLesson).mockImplementation(async ({ lesson }) =>
      taskResult({
        ...lesson,
        letters: lesson.letters.map((letter) =>
          letter.symbol === "в"
            ? letter
            : {
                ...letter,
                audioText: `${letter.symbol}о`,
                pronunciation: `Ouça ${letter.symbol}о (${letter.readingAid}o).`,
              },
        ),
      }),
    );

    const failing = new Set(["хо"]);

    vi.mocked(generateLanguageAudio).mockImplementation(async ({ text }) =>
      failing.delete(text) ? { data: null, error: new Error("TTS failed") } : voiced(),
    );

    const run = await start(alphabetReviewWorkflow, [{ lessonId, version: 1 }]);
    await expect(run.returnValue).resolves.toBe("republished");

    expect(
      vi
        .mocked(generateLanguageAudio)
        .mock.calls.map(([input]) => input.text)
        .toSorted(),
    ).toStrictEqual(["ко", "хо", "хо"]);

    const cards = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { kind: "alphabet", lessonId, retiredAt: null },
    });

    expect(cards.map((card) => card.content)).toMatchObject([
      { audioUrl: "https://blob.test/ва", symbol: "в" },
      { audioText: "хо", audioUrl: expect.stringContaining("https://blob.test/"), symbol: "х" },
      { audioText: "ко", audioUrl: expect.stringContaining("https://blob.test/"), symbol: "к" },
    ]);
  });
});
