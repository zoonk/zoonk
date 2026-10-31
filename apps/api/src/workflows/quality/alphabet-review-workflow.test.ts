import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { generateLanguageAudio } from "@zoonk/ai/tasks/audio";
import {
  type AlphabetLessonContent,
  fixAlphabetLesson,
  generateAlphabetLesson,
} from "@zoonk/ai/tasks/language/alphabet-lesson";
import { checkLessonQuality } from "@zoonk/ai/tasks/quality/lesson-check";
import { writeAlphabetLesson } from "@zoonk/core/library/language/write-alphabet-lesson";
import { prisma } from "@zoonk/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { taskResult } from "../_test-utils/recorded-outputs";
import { alphabetReviewWorkflow } from "./alphabet-review-workflow";

const CYRILLIC: AlphabetLessonContent = {
  canDo: "Leia e pronuncie в, х, о e к.",
  description: "Suas primeiras letras russas.",
  intro: [{ text: "Leia da esquerda para a direita.", title: "Direção" }],
  letters: [
    ["в", "v", "ва", "Como o v de “vida”."],
    ["х", "kh", "ха", "Mais atrás que o h de “hora”."],
    ["о", "o", "о", "Como o ô de “avô”."],
    ["к", "k", "ка", "Como o c de “casa”."],
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

/** The intro screen, then в, then х. */
const FIXED_POSITION = 2;

function contentsBesideFix(steps: readonly { content: unknown }[]): unknown[] {
  return steps.flatMap((step, position) => (position === FIXED_POSITION ? [] : [step.content]));
}

function audioUrlOf(content: unknown): unknown {
  return content && typeof content === "object" && "audioUrl" in content ? content.audioUrl : null;
}

function review(issues: { kind: "incorrect" | "jargon"; problem: string; screen: number }[]) {
  return taskResult({
    issues: issues.map((issue) => ({
      ...issue,
      fix: "Compare it with the r of “rato”.",
      severity: "blocking" as const,
    })),
  });
}

async function publishCyrillic() {
  vi.mocked(generateAlphabetLesson).mockResolvedValueOnce(
    taskResult(CYRILLIC, "openai/gpt-6-luna"),
  );

  const written = await writeAlphabetLesson({
    learnerLanguage: `x${randomUUID().slice(0, 8)}`,
    targetLanguage: "ru",
    workflowRunId: randomUUID(),
  });

  if (written.status !== "published") {
    throw new Error(`The alphabet lesson wasn't published: ${written.status}`);
  }

  vi.mocked(generateLanguageAudio).mockClear();
  return written.lessonId;
}

function readSteps(lessonId: string) {
  return prisma.step.findMany({
    orderBy: [{ version: "asc" }, { position: "asc" }],
    where: { lessonId },
  });
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

    await expect(alphabetReviewWorkflow({ lessonId })).resolves.toBe("passed");

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

  it("publishes a fix of the flagged letter as the lesson's next version, re-voicing only its new audio", async () => {
    const lessonId = await publishCyrillic();
    const published = await readSteps(lessonId);

    vi.mocked(checkLessonQuality).mockResolvedValue(review([SILENT_H]));

    vi.mocked(fixAlphabetLesson).mockImplementation(async ({ lesson }) =>
      taskResult(
        {
          ...lesson,
          letters: lesson.letters.map((letter) =>
            letter.symbol === "х"
              ? { ...letter, audioText: "хо", pronunciation: "Como o r de “rato”, mais áspero." }
              : letter,
          ),
        },
        "openai/gpt-6-luna-fix",
      ),
    );

    await expect(alphabetReviewWorkflow({ lessonId })).resolves.toBe("republished");

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
        position === FIXED_POSITION ? "openai/gpt-6-luna-fix" : "openai/gpt-6-luna",
      ),
    );

    expect(current[FIXED_POSITION]?.content).toMatchObject({
      audioText: "хо",
      pronunciation: "Como o r de “rato”, mais áspero.",
    });

    expect(audioUrlOf(current[FIXED_POSITION]?.content)).not.toBe(
      audioUrlOf(published[FIXED_POSITION]?.content),
    );

    expect(contentsBesideFix(current)).toStrictEqual(contentsBesideFix(published));
  });

  it("takes a wrong lesson out of play when its fix leaves the flagged letter as it was", async () => {
    const lessonId = await publishCyrillic();

    vi.mocked(checkLessonQuality).mockResolvedValue(review([SILENT_H]));

    vi.mocked(fixAlphabetLesson).mockImplementation(async ({ lesson }) =>
      taskResult(lesson, "openai/gpt-6-luna"),
    );

    await expect(alphabetReviewWorkflow({ lessonId })).resolves.toBe("setAside");

    expect(generateLanguageAudio).not.toHaveBeenCalled();

    const [lesson, steps] = await Promise.all([
      prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } }),
      readSteps(lessonId),
    ]);

    expect(lesson).toMatchObject({ contentStatus: "failed", setAsideAt: expect.any(Date) });
    expect(steps.every((step) => step.version === 1 && step.retiredAt === null)).toBe(true);
  });
});
