import { randomUUID } from "node:crypto";
import { generateLessonAlphabet } from "@zoonk/ai/tasks/lessons/language/alphabet";
import { generateLanguageAudio } from "@zoonk/core/audio/generate";
import { prisma } from "@zoonk/db";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createLessonContext } from "../steps/_test-utils/create-lesson-context";
import { alphabetLessonWorkflow } from "./alphabet-workflow";

const WORKFLOW_RUN_ID = "alphabet-workflow-test";

const alphabetState = vi.hoisted(() => ({
  intro: [] as { text: string; title: string }[],
  symbols: [] as {
    audioText: string;
    forms: { label: string; symbol: string }[];
    pronunciation: string;
    readingAid: string;
    symbol: string;
  }[],
}));

vi.mock("@zoonk/ai/tasks/lessons/language/alphabet", () => ({
  generateLessonAlphabet: vi
    .fn()
    .mockImplementation(() => ({
      data: { intro: alphabetState.intro, symbols: alphabetState.symbols },
    })),
}));

vi.mock("@zoonk/core/audio/generate", () => ({
  generateLanguageAudio: vi
    .fn()
    .mockImplementation(({ text }) =>
      Promise.resolve({ data: `https://example.com/audio/${encodeURIComponent(text)}.mp3` }),
    ),
}));

describe(alphabetLessonWorkflow, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    alphabetState.intro = [];
    alphabetState.symbols = [];
  });

  it("splits more than twenty symbols into balanced alphabet lessons", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const context = await createLessonContext({
      generationRunId: WORKFLOW_RUN_ID,
      generationStatus: "running",
      kind: "alphabet",
      organizationId,
      targetLanguage: "ja",
    });

    await lessonFixture({
      chapterId: context.chapterId,
      generationStatus: "pending",
      isPublished: true,
      kind: "grammar",
      organizationId,
      position: context.position + 1,
      title: `Following grammar ${uniqueId}`,
    });

    alphabetState.intro = [{ text: `Intro ${uniqueId}`, title: `Writing ${uniqueId}` }];

    alphabetState.symbols = Array.from({ length: 21 }, (_, index) => ({
      audioText: `Sound ${uniqueId} ${index + 1}`,
      forms: [],
      pronunciation: `Pronunciation ${index + 1}`,
      readingAid: `Reading ${index + 1}`,
      symbol: `Symbol ${uniqueId} ${index + 1}`,
    }));

    await alphabetLessonWorkflow({ context, workflowRunId: WORKFLOW_RUN_ID });

    expect(generateLessonAlphabet).toHaveBeenCalledOnce();
    expect(generateLanguageAudio).toHaveBeenCalledTimes(21);

    const lessons = await prisma.lesson.findMany({
      include: { steps: { orderBy: { position: "asc" } } },
      orderBy: { position: "asc" },
      where: { chapterId: context.chapterId },
    });

    expect(lessons.map((lesson) => lesson.kind)).toStrictEqual(["alphabet", "alphabet", "grammar"]);

    const alphabetLessons = lessons.filter((lesson) => lesson.kind === "alphabet");

    expect(
      alphabetLessons.map(
        (lesson) => lesson.steps.filter((step) => step.kind === "alphabet").length,
      ),
    ).toStrictEqual([11, 10]);

    expect(
      alphabetLessons.map(
        (lesson) => lesson.steps.filter((step) => step.kind === "matchColumns").length,
      ),
    ).toStrictEqual([1, 1]);

    expect(
      alphabetLessons.map((lesson) => lesson.steps.filter((step) => step.kind === "static").length),
    ).toStrictEqual([1, 0]);
  });
});
