import { randomUUID } from "node:crypto";
import { writeLessonDraft } from "@zoonk/ai/tasks/v2/lesson-writer";
import { fixLessonDraft } from "@zoonk/ai/tasks/v2/lesson-writer/fix";
import { type WrittenLesson, type WrittenScreen } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { citeMaterial } from "@zoonk/ai/tasks/v2/material/cite";
import { checkLessonQuality } from "@zoonk/ai/tasks/v2/quality/lesson-check";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { learnerSourceFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { temperatureSpec, writtenTemperatureLesson } from "../quality/_test-utils/written-lessons";
import { PAGE_BREAK, PDF_CONTENT_TYPE, PPTX_CONTENT_TYPE } from "../sources/source-contract";
import { STEP_CONTRACT_VERSION, parseStepContent } from "../steps/contract/step-contract";
import { writeLessonContent } from "./write-lesson-content";

/** Model calls are the external boundary; checks, claims and storage run for real. */
vi.mock("@zoonk/ai/tasks/v2/lesson-writer", () => ({ writeLessonDraft: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/lesson-writer/fix", () => ({ fixLessonDraft: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/quality/lesson-check", () => ({ checkLessonQuality: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/material/cite", () => ({ citeMaterial: vi.fn() }));

function provenance(model = "openai/gpt-6-sol") {
  return {
    generatedAt: new Date().toISOString(),
    latencyMs: 1,
    model,
    promptVersion: "test-prompt",
    provider: "test",
    requestedModel: model,
    runId: randomUUID(),
    usage: {},
  };
}

function mockDraft(lesson: WrittenLesson) {
  const draftProvenance = provenance();

  vi.mocked(writeLessonDraft).mockResolvedValueOnce({
    data: lesson,
    provenance: draftProvenance,
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });

  return draftProvenance;
}

function mockFix({ changedScreens, lesson }: { changedScreens: number[]; lesson: WrittenLesson }) {
  const fixProvenance = provenance();

  vi.mocked(fixLessonDraft).mockResolvedValueOnce({
    data: { changedScreens, lesson },
    provenance: fixProvenance,
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });

  return fixProvenance;
}

function mockReview(issues: Awaited<ReturnType<typeof checkLessonQuality>>["data"]["issues"] = []) {
  vi.mocked(checkLessonQuality).mockResolvedValueOnce({
    data: { issues },
    provenance: provenance("anthropic/claude-opus-5.5"),
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });
}

function withScreen(lesson: WrittenLesson, index: number, screen: WrittenScreen): WrittenLesson {
  return {
    ...lesson,
    screens: lesson.screens.map((current, at) => (at === index ? screen : current)),
  };
}

function explanation(text: string): WrittenScreen {
  return { exampleLineIdea: null, image: null, kind: "explanation", text, title: "Up is up" };
}

/** A lesson whose spec is written and whose content this run has claimed. */
async function createClaimedLesson({
  homeChapterId = null,
  ownerId = null,
  spec = temperatureSpec(),
}: { homeChapterId?: string | null; ownerId?: string | null; spec?: object | null } = {}) {
  const workflowRunId = randomUUID();
  const skill = await skillFixture({ name: "Add a rise to a temperature below zero" });

  const lesson = await libraryLessonFixture({
    contentRunId: workflowRunId,
    contentStatus: "running",
    homeChapterId,
    ...(ownerId ? { ownerId, visibility: "private" as const } : {}),
    ...(spec ? { spec, specStatus: "completed" } : {}),
  });

  await lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id });

  return { lesson, skill, workflowRunId };
}

function listSteps(lessonId: string) {
  return prisma.step.findMany({
    include: { item: true },
    orderBy: { position: "asc" },
    where: { lessonId },
  });
}

describe(writeLessonContent, () => {
  it("writes nothing for a run that doesn't hold the content claim", async () => {
    const lesson = await libraryLessonFixture({ spec: temperatureSpec() });

    await expect(
      writeLessonContent({ lessonId: lesson.id, workflowRunId: randomUUID() }),
    ).resolves.toStrictEqual({ status: "notClaimed" });

    expect(writeLessonDraft).not.toHaveBeenCalled();
  });

  it("needs the lesson's spec before writing", async () => {
    const { lesson, workflowRunId } = await createClaimedLesson({ spec: null });

    await expect(writeLessonContent({ lessonId: lesson.id, workflowRunId })).resolves.toStrictEqual(
      { status: "missingSpec" },
    );
  });

  it("publishes a lesson that passes the gate, with its summary, skills, math item and provenance", async () => {
    const { lesson, skill, workflowRunId } = await createClaimedLesson();
    const draft = mockDraft(writtenTemperatureLesson());
    mockReview();

    const result = await writeLessonContent({ lessonId: lesson.id, workflowRunId });

    expect(result).toStrictEqual({
      fixed: false,
      reviewed: true,
      status: "published",
      stepCount: 8,
    });

    expect(checkLessonQuality).toHaveBeenCalledWith(
      expect.objectContaining({ level: "beginner", writerModel: draft.model }),
    );

    const [steps, stored] = await Promise.all([
      listSteps(lesson.id),
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
    ]);

    expect(stored.contentStatus).toBe("completed");

    expect(stored.summary).toStrictEqual({
      ideas: [
        { text: "A rise moves up the thermometer, even below zero." },
        { text: "Count up to zero first, then the degrees above it." },
      ],
    });

    expect(steps.map((step) => [step.position, step.kind, step.runId, step.skillId])).toStrictEqual(
      [
        "hook",
        "explanation",
        "workedExample",
        "check",
        "explanation",
        "activity",
        "typedAnswer",
        "check",
      ].map((kind, position) => [position, kind, draft.runId, position === 0 ? null : skill.id]),
    );

    expect(steps[3]?.item).toMatchObject({
      format: "numeric",
      runId: draft.runId,
      skillId: skill.id,
    });

    expect(steps.filter((step) => step.itemId !== null)).toHaveLength(1);

    for (const { content, contractVersion, kind } of steps) {
      expect(() => parseStepContent(kind, content)).not.toThrow();
      expect(contractVersion).toBe(STEP_CONTRACT_VERSION);
    }
  });

  it("fixes what code and the reviewer found, then records the fix's run on the screens it changed", async () => {
    const { lesson, workflowRunId } = await createClaimedLesson();
    const written = writtenTemperatureLesson();
    const draft = mockDraft(withScreen(written, 1, explanation("In this lesson, a rise goes up.")));

    mockReview([
      {
        fix: "Say where it's cold.",
        kind: "unclear",
        problem: "The city is vague.",
        screen: 7,
        severity: "blocking",
      },
    ]);

    const fix = mockFix({ changedScreens: [1, 7], lesson: written });
    mockReview();

    const result = await writeLessonContent({ lessonId: lesson.id, workflowRunId });

    expect(result).toMatchObject({ fixed: true, status: "published" });

    expect(vi.mocked(fixLessonDraft).mock.calls[0]?.[0].problems).toStrictEqual([
      expect.objectContaining({ screen: 1, source: "code" }),
      expect.objectContaining({
        problem: "The city is vague. Fix: Say where it's cold.",
        screen: 7,
      }),
    ]);

    const steps = await listSteps(lesson.id);

    expect(steps.map((step) => step.runId)).toStrictEqual(
      steps.map((step) => ([1, 7].includes(step.position) ? fix.runId : draft.runId)),
    );
  });

  it("holds back a lesson that still fails after its fix pass", async () => {
    const { lesson, workflowRunId } = await createClaimedLesson();

    const filler = withScreen(
      writtenTemperatureLesson(),
      4,
      explanation("It's worth noting that zero is a mark."),
    );

    mockDraft(filler);
    mockReview();
    mockFix({ changedScreens: [], lesson: filler });
    mockReview();

    const result = await writeLessonContent({ lessonId: lesson.id, workflowRunId });

    expect(result).toStrictEqual({
      problems: [expect.objectContaining({ screen: 4, source: "code" })],
      status: "heldBack",
    });

    const [steps, stored] = await Promise.all([
      listSteps(lesson.id),
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
    ]);

    expect(steps).toStrictEqual([]);
    expect(stored.contentStatus).toBe("failed");
  });

  it("publishes after its fix pass when the reviewer only has a style problem left", async () => {
    const { lesson, workflowRunId } = await createClaimedLesson();
    const written = writtenTemperatureLesson();

    const jargon = {
      fix: "Explain the second term on its own screen.",
      kind: "jargon" as const,
      problem: 'Two new terms on one screen: "rise" and "mark".',
      screen: 1,
      severity: "blocking" as const,
    };

    mockDraft(written);
    mockReview([jargon]);
    mockFix({ changedScreens: [1], lesson: written });
    mockReview([{ ...jargon, problem: 'Two new terms on one screen: "scale" and "mark".' }]);

    await expect(writeLessonContent({ lessonId: lesson.id, workflowRunId })).resolves.toMatchObject(
      { fixed: true, status: "published" },
    );
  });

  it("holds back a lesson the reviewer still finds wrong after its fix pass", async () => {
    const { lesson, workflowRunId } = await createClaimedLesson();
    const written = writtenTemperatureLesson();

    const wrong = {
      fix: "Mark 3 °C as the answer.",
      kind: "incorrect" as const,
      problem: "The option marked correct, 11 °C, is wrong.",
      screen: 3,
      severity: "blocking" as const,
    };

    mockDraft(written);
    mockReview([wrong]);
    mockFix({ changedScreens: [3], lesson: written });
    mockReview([wrong]);

    await expect(writeLessonContent({ lessonId: lesson.id, workflowRunId })).resolves.toMatchObject(
      { problems: [expect.objectContaining({ screen: 3, source: "review" })], status: "heldBack" },
    );
  });

  it("holds back a lesson whose code activity doesn't print its expected output", async () => {
    const spec = temperatureSpec();

    const { lesson, workflowRunId } = await createClaimedLesson({
      spec: {
        ...spec,
        screens: spec.screens.map((screen) =>
          screen.kind === "activity" ? { ...screen, activityTemplate: "codeRunner" } : screen,
        ),
      },
    });

    const runner = {
      check: { explanation: "A rise adds to the start: −3 + 5 is 2.", kind: "interaction" },
      fields: {
        editableLines: [3],
        expectedOutput: "8",
        language: "javascript",
        mistakes: [{ feedback: "A rise adds degrees; it doesn't take them away.", output: "-8" }],
        solution: "const start = -3;\nconst rise = 5;\nconsole.log(start + rise);",
        starterCode: "const start = -3;\nconst rise = 5;\nconsole.log(start - rise);",
      },
      prompt: "Fix the last line so it prints the temperature after the rise.",
    };

    const written = withScreen(writtenTemperatureLesson(), 5, {
      content: JSON.stringify(runner),
      kind: "activity",
      template: "codeRunner",
    });

    mockDraft(written);
    mockReview();
    mockFix({ changedScreens: [], lesson: written });
    mockReview();

    const result = await writeLessonContent({ lessonId: lesson.id, workflowRunId });

    expect(result).toStrictEqual({
      problems: [
        {
          problem:
            'fields.expectedOutput: The solution prints "2\\n"; the expected output must be exactly what it prints',
          screen: 5,
          source: "code",
        },
      ],
      status: "heldBack",
    });

    await expect(listSteps(lesson.id)).resolves.toStrictEqual([]);
  });

  it("publishes after its fix pass when a sentence is still a little long for the level", async () => {
    const { lesson, workflowRunId } = await createClaimedLesson();
    const long = `A rise ${"always moves the mark up the thermometer ".repeat(5)}even below zero.`;
    const draft = withScreen(writtenTemperatureLesson(), 1, explanation(long));

    mockDraft(draft);
    mockReview();
    mockFix({ changedScreens: [], lesson: draft });
    mockReview();

    await expect(writeLessonContent({ lessonId: lesson.id, workflowRunId })).resolves.toMatchObject(
      { fixed: true, status: "published" },
    );
  });

  it("sends a term used before its explanation to the fix pass", async () => {
    const { lesson, workflowRunId } = await createClaimedLesson();
    const written = writtenTemperatureLesson();
    const [hook] = written.screens;

    const early = {
      ...written,
      screens: written.screens.map((screen, index) => {
        if (index === 0 && hook?.kind === "hookGuess") {
          return {
            ...hook,
            question: "It's −3 °C and the TMP rises 5 degrees. What does it show?",
          };
        }

        return index === 1 ? explanation("The **TMP** reading goes up with every degree.") : screen;
      }),
    };

    mockDraft(early);
    mockReview();
    mockFix({ changedScreens: [0], lesson: early });
    mockReview();

    await expect(writeLessonContent({ lessonId: lesson.id, workflowRunId })).resolves.toMatchObject(
      { fixed: true, status: "published" },
    );

    expect(vi.mocked(fixLessonDraft).mock.calls.at(-1)?.[0].problems).toContainEqual(
      expect.objectContaining({ problem: expect.stringContaining('Uses "TMP"'), screen: 0 }),
    );
  });

  it("writes a private lesson from its owner's material and cites a slide on each screen it can", async () => {
    const user = await userFixture();
    const { lesson, workflowRunId } = await createClaimedLesson({ ownerId: user.id });
    const goal = await goalFixture({ userId: user.id });
    const plan = await planFixture({ goalId: goal.id });

    const [slides] = await Promise.all([
      sourceFixture({
        extractedText: ["Temperatures", "A rise moves up, even below zero"].join(PAGE_BREAK),
        kind: "upload",
        mimeType: PPTX_CONTENT_TYPE,
        ownerId: user.id,
        title: "Class 3",
        visibility: "private",
      }),
      planItemFixture({ lessonId: lesson.id, phase: 0, planId: plan.id, position: 0 }),
    ]);

    await learnerSourceFixture({ goalId: goal.id, sourceId: slides.id, userId: user.id });
    mockDraft(writtenTemperatureLesson());
    mockReview();

    vi.mocked(citeMaterial).mockResolvedValueOnce({
      data: {
        citations: [
          { ref: null, screen: 1 },
          { ref: "S1:2", screen: 2 },
          { ref: "S1:9", screen: 3 },
        ],
      },
      provenance: provenance("openai/gpt-6-luna"),
      systemPrompt: "",
      usage: {} as never,
      userPrompt: "",
    });

    await writeLessonContent({ lessonId: lesson.id, workflowRunId });

    // The writer reads the slides, tagged so each page can be cited.
    expect(vi.mocked(writeLessonDraft).mock.calls.at(-1)?.[0].material).toContain(
      '<page ref="S1:2" of="Class 3, slide 2">',
    );

    const steps = await listSteps(lesson.id);

    // A reference to a slide the lesson wasn't given is dropped.
    expect(steps.slice(0, 3).map((step) => [step.sourceId, step.sourcePage])).toStrictEqual([
      [null, null],
      [slides.id, 2],
      [null, null],
    ]);
  });

  it("writes a shared lesson from its goals' public sources and cites them on the screens they support", async () => {
    const { lesson, workflowRunId } = await createClaimedLesson();
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    const plan = await planFixture({ goalId: goal.id });

    const [guidance] = await Promise.all([
      sourceFixture({
        extractedText: [
          "Agency history and contact details.",
          "A forecast rise adds to the temperature, even below zero: from −3 °C, a rise of 5 degrees reads 2 °C on the thermometer.",
        ].join(PAGE_BREAK),
        mimeType: PDF_CONTENT_TYPE,
        publisher: "National Weather Service",
        title: "Reading temperature forecasts",
      }),
      planItemFixture({ lessonId: lesson.id, phase: 0, planId: plan.id, position: 0 }),
    ]);

    await learnerSourceFixture({
      goalId: goal.id,
      origin: "research",
      sourceId: guidance.id,
      userId: user.id,
    });

    mockDraft(writtenTemperatureLesson());
    mockReview();

    vi.mocked(citeMaterial).mockResolvedValueOnce({
      data: {
        citations: [
          { ref: null, screen: 1 },
          { ref: "S1:2", screen: 2 },
          { ref: "S1:2", screen: 3 },
        ],
      },
      provenance: provenance("openai/gpt-6-luna"),
      systemPrompt: "",
      usage: {} as never,
      userPrompt: "",
    });

    await expect(writeLessonContent({ lessonId: lesson.id, workflowRunId })).resolves.toMatchObject(
      { reviewed: true, status: "published" },
    );

    // The writer and the reviewer read the passage about the lesson, not the rest of the document.
    const draftInput = vi.mocked(writeLessonDraft).mock.calls.at(-1)?.[0];
    expect(draftInput?.material).toBeUndefined();

    expect(draftInput?.sources).toContain(
      '<page ref="S1:2" of="Reading temperature forecasts, page 2">',
    );

    expect(draftInput?.sources).not.toContain("Agency history");
    expect(vi.mocked(checkLessonQuality).mock.calls.at(-1)?.[0].sources).toBe(draftInput?.sources);

    const steps = await listSteps(lesson.id);

    expect(steps.slice(0, 3).map((step) => [step.sourceId, step.sourcePage])).toStrictEqual([
      [null, null],
      [guidance.id, 2],
      [guidance.id, 2],
    ]);
  });

  it("saves nothing when another run took the claim while this one was writing", async () => {
    const { lesson, workflowRunId } = await createClaimedLesson();
    const draft = writtenTemperatureLesson();

    vi.mocked(writeLessonDraft).mockImplementationOnce(async () => {
      await prisma.lesson.update({
        data: { contentRunId: randomUUID() },
        where: { id: lesson.id },
      });

      return {
        data: draft,
        provenance: provenance(),
        systemPrompt: "",
        usage: {} as never,
        userPrompt: "",
      };
    });

    mockReview();

    await expect(writeLessonContent({ lessonId: lesson.id, workflowRunId })).resolves.toStrictEqual(
      { status: "notClaimed" },
    );

    await expect(listSteps(lesson.id)).resolves.toStrictEqual([]);
  });

  it("gives the writer the chapter's other lessons and sends an earlier lesson's example to the fix pass", async () => {
    const chapter = await libraryChapterFixture();
    const { lesson, workflowRunId } = await createClaimedLesson({ homeChapterId: chapter.id });

    const earlierQuestion =
      "At dawn it's −12 °C in Chicago. By noon it's 15 degrees warmer. What does it show?";

    const [earlier, later] = await Promise.all([
      libraryLessonFixture({
        canDo: "Read a thermometer below zero",
        homeChapterId: chapter.id,
        summary: { ideas: [{ text: "Below zero, a bigger number is colder." }] },
        title: "Temperatures below zero",
      }),
      libraryLessonFixture({
        canDo: "Work out a temperature after a drop",
        homeChapterId: chapter.id,
        title: "Temperature drops",
      }),
    ]);

    await Promise.all([
      chapterLessonFixture({ chapterId: chapter.id, lessonId: earlier.id, position: 0 }),
      chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 1 }),
      chapterLessonFixture({ chapterId: chapter.id, lessonId: later.id, position: 2 }),
      libraryStepFixture({
        content: { question: earlierQuestion, reveal: "It shows 3 °C.", variant: "guess" },
        kind: "hook",
        lessonId: earlier.id,
        position: 0,
      }),
    ]);

    const written = writtenTemperatureLesson();

    const repeated = withScreen(written, 7, {
      context: "It's −12 °C on a winter morning in Chicago, and it will warm up 15 degrees.",
      image: null,
      kind: "check",
      options: [
        {
          isCorrect: true,
          reason: "Twelve degrees reach zero and three more go above.",
          text: "3 °C",
        },
        { isCorrect: false, reason: "That's moving down instead of up.", text: "−27 °C" },
      ],
      question: "What will the thermometer show?",
    });

    mockDraft(repeated);
    mockReview();
    mockFix({ changedScreens: [7], lesson: written });
    mockReview();

    await expect(writeLessonContent({ lessonId: lesson.id, workflowRunId })).resolves.toMatchObject(
      { fixed: true, status: "published" },
    );

    expect(vi.mocked(writeLessonDraft).mock.calls.at(-1)?.[0].chapterLessons).toStrictEqual([
      {
        canDo: "Read a thermometer below zero",
        examples: [earlierQuestion],
        ideas: ["Below zero, a bigger number is colder."],
        order: "before",
        title: "Temperatures below zero",
      },
      {
        canDo: "Work out a temperature after a drop",
        examples: [],
        ideas: [],
        order: "after",
        title: "Temperature drops",
      },
    ]);

    expect(vi.mocked(fixLessonDraft).mock.calls.at(-1)?.[0].problems).toContainEqual(
      expect.objectContaining({
        problem: expect.stringContaining(
          'Reuses the numbers 12, 15 from the earlier lesson "Temperatures below zero"',
        ),
        screen: 7,
        source: "code",
      }),
    );
  });
});
