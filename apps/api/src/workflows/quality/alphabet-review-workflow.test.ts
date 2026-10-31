import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
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
import { taskResult } from "../_test-utils/recorded-outputs";
import { alphabetReviewWorkflow } from "./alphabet-review-workflow";

const CYRILLIC: AlphabetLessonContent = {
  canDo: "Leia e pronuncie в, х, о e к.",
  description: "Suas primeiras letras russas.",
  intro: [{ text: "Leia da esquerda para a direita.", title: "Direção" }],
  letters: [
    ["в", "v", "ва", "Como o v de “vida”; ouça ва (va)."],
    ["х", "kh", "ха", "Mais atrás que o h de “hora”; ouça ха (kha)."],
    ["о", "o", "о", "Como o ô de “avô”."],
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

const SILENT_H = { kind: "incorrect", problem: "The h of “hora” is silent.", screen: 2 } as const;

const X_CARD = 2;

function contentsBesideX(steps: readonly { content: unknown }[]): unknown[] {
  return steps.flatMap((step, position) => (position === X_CARD ? [] : [step.content]));
}

function audioUrlOf(content: unknown): unknown {
  return content && typeof content === "object" && "audioUrl" in content ? content.audioUrl : null;
}

function review(
  issues: { kind: "incorrect" | "jargon"; problem: string; screen: number | null }[],
) {
  return taskResult({
    issues: issues.map((issue) => ({
      ...issue,
      fix: "Compare it with the r of “rato”.",
      severity: "blocking" as const,
    })),
  });
}

function fixX(changes: Partial<AlphabetLessonContent["letters"][number]>) {
  vi.mocked(fixAlphabetLesson).mockImplementation(async ({ lesson }) =>
    taskResult(
      {
        ...lesson,
        letters: lesson.letters.map((letter) =>
          letter.symbol === "х" ? { ...letter, ...changes } : letter,
        ),
      },
      "openai/gpt-6-luna-fix",
    ),
  );
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

  return written.lessonId;
}

function readSteps(lessonId: string) {
  return prisma.step.findMany({
    orderBy: [{ version: "asc" }, { position: "asc" }],
    where: { lessonId },
  });
}

async function expectSetAside(lessonId: string) {
  const [lesson, steps] = await Promise.all([
    prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } }),
    readSteps(lessonId),
  ]);

  expect(lesson).toMatchObject({ contentStatus: "failed", setAsideAt: expect.any(Date) });
  expect(steps.every((step) => step.version === 1 && step.retiredAt === null)).toBe(true);
}

describe(alphabetReviewWorkflow, () => {
  beforeEach(() => {
    vi.mocked(generateLanguageAudio).mockResolvedValue({
      data: {
        audio: new Uint8Array([1, 2, 3]),
        durationMs: 900,
        format: "mp3",
        provenance: {
          generatedAt: new Date().toISOString(),
          latencyMs: 900,
          model: "google/gemini-3.8-flash-tts",
          promptVersion: "speech-v1",
          provider: "vertex",
          requestedModel: "google/gemini-3.8-flash-tts",
          runId: "speech-run",
          usage: {},
        },
      },
      error: null,
    });

    vi.mocked(put).mockImplementation(async (pathname) => ({
      contentDisposition: "inline",
      contentType: "audio/mpeg",
      downloadUrl: `https://blob.test/${randomUUID()}/${pathname}`,
      etag: "",
      pathname,
      url: `https://blob.test/${randomUUID()}/${pathname}`,
    }));
  });

  it("keeps a published lesson whose review finds nothing wrong", async () => {
    const lessonId = await publishCyrillic();

    vi.mocked(checkLessonQuality).mockResolvedValue(
      review([{ kind: "jargon", problem: "“Fricção” is jargon.", screen: 2 }]),
    );

    await expect(alphabetReviewWorkflow({ lessonId, version: 1 })).resolves.toBe("passed");

    expect(checkLessonQuality).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        alphabet: true,
        courseTitle: "Russian",
        reuse: "bounded",
        serviceTier: "flex",
        writerModel: "openai/gpt-6-luna",
      }),
    );

    expect(fixAlphabetLesson).not.toHaveBeenCalled();

    const steps = await readSteps(lessonId);
    expect(steps.every((step) => step.version === 1 && step.retiredAt === null)).toBe(true);
  });

  it("leaves a lesson whose reviewed version was replaced", async () => {
    const lessonId = await publishCyrillic();

    await expect(alphabetReviewWorkflow({ lessonId, version: 2 })).resolves.toBe("replaced");
    expect(checkLessonQuality).not.toHaveBeenCalled();
  });

  it("publishes a fix of the flagged letter as the lesson's next version, re-voicing only its new audio", async () => {
    const lessonId = await publishCyrillic();
    const published = await readSteps(lessonId);

    vi.mocked(checkLessonQuality).mockResolvedValue(review([SILENT_H]));
    fixX({ audioText: "хо", pronunciation: "Como o r de “rato”, mais áspero; ouça хо (kho)." });

    await expect(alphabetReviewWorkflow({ lessonId, version: 1 })).resolves.toBe("republished");

    expect(fixAlphabetLesson).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        problems: [
          {
            problem: "The h of “hora” is silent. Fix: Compare it with the r of “rato”.",
            screen: 2,
          },
        ],
        serviceTier: "flex",
        targetLanguage: "ru",
      }),
    );

    expect(vi.mocked(generateLanguageAudio).mock.calls.map(([input]) => input.text)).toStrictEqual([
      "хо",
    ]);

    const [lesson, steps] = await Promise.all([
      prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } }),
      readSteps(lessonId),
    ]);

    const current = steps.filter((step) => step.retiredAt === null);

    expect(lesson.contentStatus).toBe("completed");
    expect(steps.filter((step) => step.version === 1).every((step) => step.retiredAt)).toBe(true);
    expect(current.map((step) => step.version)).toStrictEqual(published.map(() => 2));

    expect(current.map((step) => step.model)).toStrictEqual(
      published.map((_, position) =>
        position === X_CARD ? "openai/gpt-6-luna-fix" : "openai/gpt-6-luna",
      ),
    );

    expect(current[X_CARD]?.content).toMatchObject({
      audioText: "хо",
      pronunciation: "Como o r de “rato”, mais áspero; ouça хо (kho).",
    });

    expect(audioUrlOf(current[X_CARD]?.content)).not.toBe(audioUrlOf(published[X_CARD]?.content));
    expect(contentsBesideX(current)).toStrictEqual(contentsBesideX(published));
  });

  it("publishes a fix of the whole lesson's words and keeps every letter card", async () => {
    const lessonId = await publishCyrillic();
    const published = await readSteps(lessonId);

    const words = {
      canDo: "Leia e pronuncie в, х, о e к sozinhas.",
      title: "Quatro letras russas",
    };

    vi.mocked(checkLessonQuality).mockResolvedValue(
      review([{ kind: "incorrect", problem: "The title promises more letters.", screen: null }]),
    );

    vi.mocked(fixAlphabetLesson).mockImplementation(async ({ lesson }) =>
      taskResult({ ...lesson, ...words }),
    );

    await expect(alphabetReviewWorkflow({ lessonId, version: 1 })).resolves.toBe("republished");
    expect(generateLanguageAudio).not.toHaveBeenCalled();

    const [lesson, steps] = await Promise.all([
      prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } }),
      readSteps(lessonId),
    ]);

    const current = steps.filter((step) => step.retiredAt === null);

    expect(lesson).toMatchObject({ ...words, description: CYRILLIC.description });
    expect(current.map((step) => step.version)).toStrictEqual(published.map(() => 2));

    expect(current.map((step) => step.content)).toStrictEqual(
      published.map((step) => step.content),
    );
  });

  it("takes a wrong lesson out of play when its fix leaves the flagged letter as it was", async () => {
    const lessonId = await publishCyrillic();

    vi.mocked(checkLessonQuality).mockResolvedValue(review([SILENT_H]));

    vi.mocked(fixAlphabetLesson).mockImplementation(async ({ lesson }) =>
      taskResult(lesson, "openai/gpt-6-luna"),
    );

    await expect(alphabetReviewWorkflow({ lessonId, version: 1 })).resolves.toBe("setAside");

    expect(generateLanguageAudio).not.toHaveBeenCalled();
    await expectSetAside(lessonId);
  });

  it("takes a wrong lesson out of play when its fix fails the lesson's checks", async () => {
    const lessonId = await publishCyrillic();

    vi.mocked(checkLessonQuality).mockResolvedValue(review([SILENT_H]));
    fixX({ pronunciation: "Como o r de “rato”; ouça ха (kha).", readingAid: "  " });

    await expect(alphabetReviewWorkflow({ lessonId, version: 1 })).resolves.toBe("setAside");

    expect(generateLanguageAudio).not.toHaveBeenCalled();
    await expectSetAside(lessonId);
  });
});
