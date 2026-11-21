import { generateLanguageAudio } from "@zoonk/ai/tasks/audio";
import {
  type LanguageLessonContent,
  fixLanguageLesson,
  generateLanguageLesson,
} from "@zoonk/ai/tasks/language/language-lesson";
import { checkLanguageLesson } from "@zoonk/ai/tasks/language/language-lesson-check";
import { prisma } from "@zoonk/db";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { languageLessonDraft } from "../../../../../packages/core/src/library/language/_test-utils/language-lesson-draft";
import { taskResult } from "../_test-utils/recorded-outputs";
import { lessonContentWorkflow } from "./lesson-content-workflow";

/**
 * The mocked review skips the task's 1-based numbering, so these are indexes: three word cards, then
 * the translation choices, second word first.
 */
const FIRST_CARD = 0;
const SECOND_CARD = 1;
const FIRST_WORD_CHOICE = 5;

const DRAFT = languageLessonDraft();

function review(issues: { problem: string; screen: number | null }[]) {
  return taskResult(
    { issues: issues.map((issue) => ({ ...issue, fix: "Use another form." })) },
    "anthropic/claude-sonnet-5.5",
  );
}

function fixWith(edit: (lesson: LanguageLessonContent) => LanguageLessonContent) {
  vi.mocked(fixLanguageLesson).mockImplementation(async ({ lesson }) =>
    taskResult(edit(structuredClone(lesson)), "openai/gpt-6.1-terra"),
  );
}

function withDistractors(lesson: LanguageLessonContent, index: number, distractors: string[]) {
  return {
    ...lesson,
    words: lesson.words.map((word, position) =>
      position === index ? { ...word, distractors } : word,
    ),
  };
}

async function writeLanguageLesson(
  drafts: Awaited<ReturnType<typeof generateLanguageLesson>>[] = [],
) {
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

  vi.mocked(generateLanguageLesson).mockResolvedValue(taskResult(DRAFT, "openai/gpt-6.1-terra"));

  for (const draft of drafts) {
    vi.mocked(generateLanguageLesson).mockResolvedValueOnce(draft);
  }

  const result = await lessonContentWorkflow({ lessonId: lesson.id });
  return { lessonId: lesson.id, result };
}

function readLesson(lessonId: string) {
  return prisma.lesson.findUniqueOrThrow({
    include: { words: { include: { word: true }, orderBy: { position: "asc" } } },
    where: { id: lessonId },
  });
}

describe("a language lesson's review", () => {
  beforeEach(() => {
    vi.mocked(generateLanguageAudio).mockResolvedValue({
      data: null,
      error: new Error("No voice"),
    });
  });

  it("reviews the screens as learners will see them before publishing the lesson", async () => {
    vi.mocked(checkLanguageLesson).mockResolvedValue(review([]));

    const { lessonId, result } = await writeLanguageLesson();

    expect(result).toStrictEqual({ lessonId, status: "ready" });

    await expect(
      prisma.lessonQualityDecision.findMany({ orderBy: { id: "asc" }, where: { lessonId } }),
    ).resolves.toMatchObject([
      { outcome: "passed", phase: "codeCheck" },
      { outcome: "passed", phase: "firstReview", reviewerRunId: expect.any(String) },
    ]);

    expect(checkLanguageLesson).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        learnerLanguage: "pt",
        screens: expect.arrayContaining([
          {
            content: expect.objectContaining({ options: expect.any(Array), prompt: "o aluguel" }),
            kind: "translation",
          },
        ]),
        targetLanguage: "en",
        writerModel: "openai/gpt-6.1-terra",
      }),
    );

    expect(fixLanguageLesson).not.toHaveBeenCalled();
  });

  it("publishes the lesson as written when its writer finds the problem isn't real", async () => {
    vi.mocked(checkLanguageLesson).mockResolvedValue(
      review([{ problem: "The respelling is wrong.", screen: FIRST_CARD }]),
    );

    fixWith((lesson) => lesson);

    const { lessonId, result } = await writeLanguageLesson();

    expect(result).toStrictEqual({ lessonId, status: "ready" });
    expect(fixLanguageLesson).toHaveBeenCalledOnce();
    expect(checkLanguageLesson).toHaveBeenCalledOnce();
  });

  it("publishes the writer's fix, without counting a finding the writer left unchanged", async () => {
    const declined = { problem: "This option may be right too.", screen: SECOND_CARD };

    vi.mocked(checkLanguageLesson)
      .mockResolvedValueOnce(
        review([{ problem: "“grand inava” isn't a word.", screen: FIRST_WORD_CHOICE }, declined]),
      )
      .mockResolvedValue(review([declined]));

    fixWith((lesson) => withDistractors(lesson, 0, ["the salary", "the fee", "the bill"]));

    const { lessonId, result } = await writeLanguageLesson();

    expect(result).toStrictEqual({ lessonId, status: "ready" });

    expect(fixLanguageLesson).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        lesson: expect.objectContaining({ summary: DRAFT.summary }),
        model: "openai/gpt-6.1-terra",
        problems: [
          {
            problem: "“grand inava” isn't a word. Fix: Use another form.",
            screen: FIRST_WORD_CHOICE,
            source: "review",
          },
          {
            problem: "This option may be right too. Fix: Use another form.",
            screen: SECOND_CARD,
            source: "review",
          },
        ],
      }),
    );

    const saved = await readLesson(lessonId);

    expect(saved.words[0]?.distractors).toStrictEqual(["the salary", "the fee", "the bill"]);
  });

  it("holds the lesson back when the fix still has an error on a screen it changed", async () => {
    const flagged = { problem: "The option is right too.", screen: FIRST_WORD_CHOICE };

    vi.mocked(checkLanguageLesson).mockResolvedValue(review([flagged]));
    fixWith((lesson) => withDistractors(lesson, 0, ["the fee", "a rent", "the bill"]));

    const { lessonId, result } = await writeLanguageLesson();

    expect(result.status).toBe("heldBack");

    const held = await readLesson(lessonId);

    await expect(
      prisma.lessonQualityDecision.findMany({ orderBy: { id: "asc" }, where: { lessonId } }),
    ).resolves.toMatchObject([
      { outcome: "passed", phase: "codeCheck" },
      { outcome: "needsFix", phase: "firstReview" },
    ]);

    expect(held.contentStatus).not.toBe("completed");
    expect(held.words).toStrictEqual([]);

    expect(held.heldBackDrafts).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          problems: [
            {
              problem: "The option is right too. Fix: Use another form.",
              screen: FIRST_WORD_CHOICE,
            },
          ],
        }),
      ]),
    );
  });

  it("records both first reviews when a language lesson needs a redraft", async () => {
    const flagged = { problem: "The option is right too.", screen: FIRST_WORD_CHOICE };

    vi.mocked(checkLanguageLesson)
      .mockResolvedValueOnce(review([flagged]))
      .mockResolvedValueOnce(review([flagged]))
      .mockResolvedValueOnce(review([]));

    fixWith((lesson) => withDistractors(lesson, 0, ["the fee", "a rent", "the bill"]));

    const first = taskResult(DRAFT, "openai/gpt-6.1-terra");
    const second = taskResult(DRAFT, "openai/gpt-6.1-terra");
    const { lessonId, result } = await writeLanguageLesson([first, second]);

    expect(result.status).toBe("ready");

    await expect(
      prisma.lessonQualityDecision.findMany({
        orderBy: { id: "asc" },
        where: { lessonId, phase: "firstReview" },
      }),
    ).resolves.toMatchObject([
      { outcome: "needsFix", writerRunId: first.provenance.runId },
      { outcome: "passed", writerRunId: second.provenance.runId },
    ]);
  });
});
