import { generateLanguageAudio } from "@zoonk/ai/tasks/audio";
import {
  type LanguageLessonContent,
  fixLanguageLesson,
  generateLanguageLesson,
} from "@zoonk/ai/tasks/language/language-lesson";
import { checkLanguageLesson } from "@zoonk/ai/tasks/language/language-lesson-check";
import { type LanguageLessonCheckPlan } from "@zoonk/core/library/language/write-lesson-content";
import { prisma } from "@zoonk/db";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { languageLessonDraft } from "../../../../../packages/core/src/library/language/_test-utils/language-lesson-draft";
import { taskResult } from "../_test-utils/recorded-outputs";
import { sentenceOrdersWorkflow } from "../language/sentence-orders-workflow";
import { lessonContentWorkflow } from "../lessons/lesson-content-workflow";
import { languageReviewWorkflow } from "./language-review-workflow";

/** The mocked review skips the task's 1-based numbering, so these are indexes: the word cards come first. */
const FIRST_CARD = 0;
const SECOND_CARD = 1;

function review(issues: { problem: string; screen: number | null }[]) {
  return taskResult({ issues: issues.map((issue) => ({ ...issue, fix: "Use another form." })) });
}

function fixWith(edit: (lesson: LanguageLessonContent) => LanguageLessonContent) {
  vi.mocked(fixLanguageLesson).mockImplementation(async ({ lesson }) =>
    taskResult(edit(structuredClone(lesson)), "openai/gpt-6.1-terra"),
  );
}

function withPronunciation(lesson: LanguageLessonContent, index: number, pronunciation: string) {
  return {
    ...lesson,
    words: lesson.words.map((word, position) =>
      position === index ? { ...word, pronunciation } : word,
    ),
  };
}

async function publishLanguageLesson(): Promise<{
  lessonId: string;
  plan: LanguageLessonCheckPlan;
}> {
  await aiOrganizationFixture();

  const chapter = await libraryChapterFixture({
    language: "pt",
    objectives: ["Alugar um apartamento"],
    targetLanguage: "en",
  });

  const lesson = await libraryLessonFixture({
    homeChapterId: chapter.id,
    language: "pt",
    specStatus: "completed",
    targetLanguage: "en",
  });

  vi.mocked(generateLanguageLesson).mockResolvedValueOnce(
    taskResult(languageLessonDraft(), "openai/gpt-6.1-terra"),
  );

  await lessonContentWorkflow({ lessonId: lesson.id });

  const call = vi
    .mocked(start)
    .mock.calls.find(([workflow]) => workflow === languageReviewWorkflow);

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The content workflow starts the review with this plan.
  const [input] = (call?.[1] ?? []) as [{ plan: LanguageLessonCheckPlan }];
  vi.mocked(start).mockClear();

  return { lessonId: lesson.id, plan: input.plan };
}

function readCurrentSteps(lessonId: string) {
  return prisma.step.findMany({
    orderBy: { position: "asc" },
    where: { lessonId, retiredAt: null, staged: false },
  });
}

describe(languageReviewWorkflow, () => {
  beforeEach(() => {
    vi.mocked(generateLanguageAudio).mockResolvedValue({
      data: null,
      error: new Error("No voice"),
    });
  });

  it("keeps a published lesson whose review finds nothing wrong", async () => {
    const { lessonId, plan } = await publishLanguageLesson();
    vi.mocked(checkLanguageLesson).mockResolvedValue(review([]));

    await expect(languageReviewWorkflow({ lessonId, plan })).resolves.toBe("passed");

    expect(checkLanguageLesson).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        learnerLanguage: "pt",
        screens: expect.arrayContaining([
          {
            content: expect.objectContaining({ options: expect.any(Array), prompt: "o aluguel" }),
            kind: "translation",
          },
        ]),
        serviceTier: "flex",
        targetLanguage: "en",
        writerModel: "openai/gpt-6.1-terra",
      }),
    );

    expect(fixLanguageLesson).not.toHaveBeenCalled();
  });

  it("leaves a lesson whose reviewed version was replaced", async () => {
    const { lessonId, plan } = await publishLanguageLesson();

    await expect(languageReviewWorkflow({ lessonId, plan: { ...plan, version: 2 } })).resolves.toBe(
      "replaced",
    );

    expect(checkLanguageLesson).not.toHaveBeenCalled();
  });

  it("keeps the published lesson when its writer finds the problem isn't real", async () => {
    const { lessonId, plan } = await publishLanguageLesson();
    const published = await readCurrentSteps(lessonId);

    vi.mocked(checkLanguageLesson).mockResolvedValue(
      review([{ problem: "The respelling is wrong.", screen: FIRST_CARD }]),
    );

    fixWith((lesson) => lesson);

    await expect(languageReviewWorkflow({ lessonId, plan })).resolves.toBe("unchanged");
    expect(checkLanguageLesson).toHaveBeenCalledOnce();
    await expect(readCurrentSteps(lessonId)).resolves.toStrictEqual(published);
  });

  it("keeps the published lesson when the fix still has an error on a screen it changed", async () => {
    const { lessonId, plan } = await publishLanguageLesson();
    const published = await readCurrentSteps(lessonId);
    const flagged = { problem: "The respelling adds a vowel.", screen: FIRST_CARD };

    vi.mocked(checkLanguageLesson).mockResolvedValue(review([flagged]));
    fixWith((lesson) => withPronunciation(lesson, FIRST_CARD, "a-RÉNT"));

    await expect(languageReviewWorkflow({ lessonId, plan })).resolves.toBe("unfixed");
    await expect(readCurrentSteps(lessonId)).resolves.toStrictEqual(published);
  });

  it("publishes a fix as the next version, without counting a finding the writer left unchanged", async () => {
    const { lessonId, plan } = await publishLanguageLesson();
    const declined = { problem: "This respelling may be wrong.", screen: SECOND_CARD };

    vi.mocked(checkLanguageLesson)
      .mockResolvedValueOnce(
        review([{ problem: "The respelling adds a vowel.", screen: FIRST_CARD }, declined]),
      )
      .mockResolvedValue(review([declined]));

    fixWith((lesson) => withPronunciation(lesson, FIRST_CARD, "RÊNT"));

    await expect(languageReviewWorkflow({ lessonId, plan })).resolves.toBe("republished");

    expect(fixLanguageLesson).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        lesson: plan.lesson,
        model: "openai/gpt-6.1-terra",
        problems: [
          {
            problem: "The respelling adds a vowel. Fix: Use another form.",
            screen: FIRST_CARD,
            source: "review",
          },
          {
            problem: "This respelling may be wrong. Fix: Use another form.",
            screen: SECOND_CARD,
            source: "review",
          },
        ],
        serviceTier: "flex",
      }),
    );

    const steps = await readCurrentSteps(lessonId);

    expect(steps.map((step) => step.version)).toStrictEqual(steps.map(() => 2));
    expect(steps.every((step) => step.model === "openai/gpt-6.1-terra")).toBe(true);

    expect(start).toHaveBeenCalledWith(
      sentenceOrdersWorkflow,
      [{ analytics: undefined, lessonId, wait: "later" }],
      expect.anything(),
    );
  });
});
