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
import { buildSetupSkillIdentityKey } from "@zoonk/utils/identity-key";
import { describe, expect, it, vi } from "vitest";
import { claimLibraryGeneration } from "../claims/generation-claim";
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

function withScreen(lesson: WrittenLesson, index: number, screen: WrittenScreen): WrittenLesson {
  return {
    ...lesson,
    screens: lesson.screens.map((current, at) => (at === index ? screen : current)),
  };
}

function explanation(text: string): WrittenScreen {
  return {
    exampleLineIdea: null,
    explore: null,
    image: null,
    kind: "explanation",
    text,
    title: "Up is up",
    visual: null,
  };
}

/** A lesson whose spec is written and whose content this run has claimed. */
async function createClaimedLesson({
  homeChapterId = null,
  ownerId = null,
  skillIdentityKey,
  spec = temperatureSpec(),
}: {
  homeChapterId?: string | null;
  ownerId?: string | null;
  skillIdentityKey?: string;
  spec?: object | null;
} = {}) {
  const workflowRunId = randomUUID();

  const skill = await skillFixture({
    name: "Add a rise to a temperature below zero",
    ...(skillIdentityKey ? { identityKey: skillIdentityKey } : {}),
  });

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

  it("publishes a lesson as soon as its code checks pass, leaving the reviewer to the check after it", async () => {
    const { lesson, skill, workflowRunId } = await createClaimedLesson();
    const written = writtenTemperatureLesson();
    const draft = mockDraft(written);

    const result = await writeLessonContent({ lessonId: lesson.id, workflowRunId });

    // A lesson with math gets the reasoning check, after publishing: nobody waits on it.
    expect(result).toStrictEqual({
      check: { cite: false, lesson: written, review: true, version: 1, writerModel: draft.model },
      fixed: false,
      status: "published",
      stepCount: 8,
    });

    expect(checkLessonQuality).not.toHaveBeenCalled();

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

  it("fixes what the code checks found, then records the fix's run on the screens it changed", async () => {
    const { lesson, workflowRunId } = await createClaimedLesson();
    const written = writtenTemperatureLesson();
    const draft = mockDraft(withScreen(written, 1, explanation("In this lesson, a rise goes up.")));
    const fix = mockFix({ changedScreens: [1], lesson: written });

    const result = await writeLessonContent({ lessonId: lesson.id, workflowRunId });

    expect(result).toMatchObject({ check: { lesson: written }, fixed: true, status: "published" });
    expect(checkLessonQuality).not.toHaveBeenCalled();

    expect(vi.mocked(fixLessonDraft).mock.calls[0]?.[0].problems).toStrictEqual([
      expect.objectContaining({ screen: 1, source: "code" }),
    ]);

    const steps = await listSteps(lesson.id);

    expect(steps.map((step) => step.runId)).toStrictEqual(
      steps.map((step) => (step.position === 1 ? fix.runId : draft.runId)),
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
    mockFix({ changedScreens: [], lesson: filler });

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

    // A shared lesson gets one fix pass, then fresh drafts (see the workflow's redrafts).
    expect(fixLessonDraft).toHaveBeenCalledOnce();
    expect(stored.setAsideAt).toBeNull();
  });

  it("gives a private lesson a second fix pass on what the code checks still flag", async () => {
    const user = await userFixture();
    const { lesson, workflowRunId } = await createClaimedLesson({ ownerId: user.id });
    const written = writtenTemperatureLesson();
    const filler = withScreen(written, 4, explanation("It's worth noting that zero is a mark."));

    mockDraft(filler);
    mockFix({ changedScreens: [], lesson: filler });
    const fix = mockFix({ changedScreens: [4], lesson: written });

    await expect(writeLessonContent({ lessonId: lesson.id, workflowRunId })).resolves.toMatchObject(
      { check: { lesson: written }, fixed: true, status: "published" },
    );

    expect(writeLessonDraft).toHaveBeenCalledOnce();
    expect(fixLessonDraft).toHaveBeenCalledTimes(2);

    expect(vi.mocked(fixLessonDraft).mock.calls[1]?.[0]).toMatchObject({
      lesson: filler,
      problems: [expect.objectContaining({ screen: 4, source: "code" })],
    });

    const steps = await listSteps(lesson.id);
    expect(steps.find((step) => step.position === 4)?.runId).toBe(fix.runId);
  });

  it("repairs Markdown learners would see and an option written twice in code, with no fix pass", async () => {
    const user = await userFixture();
    const { lesson, workflowRunId } = await createClaimedLesson({ ownerId: user.id });
    const written = writtenTemperatureLesson();
    const [guess] = written.screens;

    if (guess?.kind !== "hookGuess") {
      throw new Error("The temperature lesson opens on a guess.");
    }

    // Italics split across lines show their underscores, since the player reads line by line, and
    // "2.0 °C" is the right answer written again.
    const twin = withScreen(written, 0, {
      ...guess,
      options: [...guess.options, { isCorrect: false, text: "2.0 °C" }],
    });

    mockDraft(withScreen(twin, 4, explanation("_Zero is a mark.\nCount past it._")));

    await expect(writeLessonContent({ lessonId: lesson.id, workflowRunId })).resolves.toMatchObject(
      { fixed: false, status: "published" },
    );

    expect(fixLessonDraft).not.toHaveBeenCalled();

    const steps = await listSteps(lesson.id);
    const opening = steps.find((step) => step.position === 0);
    const stored = steps.find((step) => step.position === 4);

    expect(stored && parseStepContent("explanation", stored.content).text).toBe(
      "Zero is a mark.\nCount past it.",
    );

    // Options are shuffled when stored.
    const content = opening?.content as { options?: { text: string }[] } | undefined;
    const options = content?.options ?? [];

    expect(options.map((option) => option.text).toSorted()).toStrictEqual(
      ["2 °C", "8 °C", "−8 °C"].toSorted(),
    );
  });

  it("never stores what code can't repair: a private lesson's code checks send it to the fix pass, with no review", async () => {
    const user = await userFixture();
    const { lesson, workflowRunId } = await createClaimedLesson({ ownerId: user.id });
    const written = writtenTemperatureLesson();

    // A slot the writer left to fill in.
    const unfinished = withScreen(written, 4, explanation("Zero is a mark. [Inserir exemplo]"));

    mockDraft(unfinished);
    mockFix({ changedScreens: [4], lesson: written });

    await expect(writeLessonContent({ lessonId: lesson.id, workflowRunId })).resolves.toMatchObject(
      { fixed: true, status: "published" },
    );

    expect(vi.mocked(fixLessonDraft).mock.calls[0]?.[0]).toMatchObject({
      problems: [expect.objectContaining({ screen: 4, source: "code" })],
    });

    expect(checkLessonQuality).not.toHaveBeenCalled();

    const steps = await listSteps(lesson.id);
    const stored = steps.find((step) => step.position === 4);

    expect(stored && parseStepContent("explanation", stored.content).text).toBe(
      "Zero is just a mark on the way up. Count the degrees to zero, then the degrees after it.",
    );
  });

  it("sets a private lesson aside when its fix passes leave it failing, without a fresh draft", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    const plan = await planFixture({ goalId: goal.id });
    const { lesson, workflowRunId } = await createClaimedLesson({ ownerId: user.id });
    const item = await planItemFixture({ lessonId: lesson.id, phase: 0, planId: plan.id });

    const filler = withScreen(
      writtenTemperatureLesson(),
      4,
      explanation("It's worth noting that zero is a mark."),
    );

    mockDraft(filler);
    mockFix({ changedScreens: [], lesson: filler });
    mockFix({ changedScreens: [], lesson: filler });

    await expect(writeLessonContent({ lessonId: lesson.id, workflowRunId })).resolves.toMatchObject(
      { status: "heldBack" },
    );

    const [stored, planItem] = await Promise.all([
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
      prisma.planItem.findUniqueOrThrow({ where: { id: item.id } }),
    ]);

    expect(stored.contentStatus).toBe("failed");
    expect(stored.setAsideAt).toBeInstanceOf(Date);
    expect(planItem.status).toBe("skipped");
  });

  it("never reviews a private lesson, even one with math that a rewrite asks to review", async () => {
    const user = await userFixture();
    const { lesson, workflowRunId } = await createClaimedLesson({ ownerId: user.id });
    mockDraft(writtenTemperatureLesson());

    await expect(
      writeLessonContent({ forceReview: true, lessonId: lesson.id, workflowRunId }),
    ).resolves.toMatchObject({ check: { cite: false, review: false }, status: "published" });
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
    mockFix({ changedScreens: [], lesson: written });

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
    mockFix({ changedScreens: [], lesson: draft });

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
    mockFix({ changedScreens: [0], lesson: early });

    await expect(writeLessonContent({ lessonId: lesson.id, workflowRunId })).resolves.toMatchObject(
      { fixed: true, status: "published" },
    );

    expect(vi.mocked(fixLessonDraft).mock.calls.at(-1)?.[0].problems).toContainEqual(
      expect.objectContaining({ problem: expect.stringContaining('Uses "TMP"'), screen: 0 }),
    );
  });

  it("writes a private lesson from its owner's material and leaves its citations to the check after publishing", async () => {
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

    // Only reusable lessons are reviewed: a private one is cited after publishing, never reviewed.
    await expect(writeLessonContent({ lessonId: lesson.id, workflowRunId })).resolves.toMatchObject(
      { check: { cite: true, review: false }, status: "published" },
    );

    // The writer reads the slides, tagged so each page can be cited.
    expect(vi.mocked(writeLessonDraft).mock.calls.at(-1)?.[0].material).toContain(
      '<page ref="S1:2" of="Class 3, slide 2">',
    );

    expect(citeMaterial).not.toHaveBeenCalled();

    const steps = await listSteps(lesson.id);
    expect(steps.every((step) => step.sourceId === null)).toBe(true);
  });

  it("writes a shared lesson from the passages of its goals' public sources it teaches", async () => {
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

    await expect(writeLessonContent({ lessonId: lesson.id, workflowRunId })).resolves.toMatchObject(
      { check: { cite: true, review: true }, status: "published" },
    );

    // The writer reads the passage about the lesson, not the rest of the document.
    const draftInput = vi.mocked(writeLessonDraft).mock.calls.at(-1)?.[0];
    expect(draftInput?.material).toBeUndefined();

    expect(draftInput?.sources).toContain(
      '<page ref="S1:2" of="Reading temperature forecasts, page 2">',
    );

    expect(draftInput?.sources).not.toContain("Agency history");
  });

  it("writes a setup lesson with the setup rules, and other lessons without them", async () => {
    const [setup, other] = await Promise.all([
      createClaimedLesson({
        skillIdentityKey: buildSetupSkillIdentityKey({ system: "windows", tool: randomUUID() }),
      }),
      createClaimedLesson(),
    ]);

    mockDraft(writtenTemperatureLesson());
    await writeLessonContent({ lessonId: setup.lesson.id, workflowRunId: setup.workflowRunId });
    expect(vi.mocked(writeLessonDraft).mock.calls.at(-1)?.[0].setup).toBe(true);

    mockDraft(writtenTemperatureLesson());
    await writeLessonContent({ lessonId: other.lesson.id, workflowRunId: other.workflowRunId });
    expect(vi.mocked(writeLessonDraft).mock.calls.at(-1)?.[0].setup).toBe(false);
  });

  it("publishes a rewrite of a lesson taken out of play as its next version, keeping the old screens for learners playing them", async () => {
    const { lesson } = await createClaimedLesson();
    const old = await libraryStepFixture({ lessonId: lesson.id, position: 0 });
    const workflowRunId = randomUUID();

    // The lesson was pulled for a rewrite, and this run claims it.
    await prisma.lesson.update({
      data: { contentRunId: null, contentStatus: "failed" },
      where: { id: lesson.id },
    });

    await expect(
      claimLibraryGeneration({ id: lesson.id, target: "lessonContent", workflowRunId }),
    ).resolves.toBe("claimed");

    mockDraft(writtenTemperatureLesson());

    await expect(writeLessonContent({ lessonId: lesson.id, workflowRunId })).resolves.toMatchObject(
      { check: { version: 2 }, status: "published" },
    );

    const steps = await listSteps(lesson.id);
    const current = steps.filter((step) => step.retiredAt === null);

    expect(current.map((step) => step.version)).toStrictEqual(Array.from({ length: 8 }, () => 2));

    expect(steps.find((step) => step.id === old.id)).toMatchObject({
      retiredAt: expect.any(Date),
      version: 1,
    });
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
          picture: null,
          reason: "Twelve degrees reach zero and three more go above.",
          text: "3 °C",
        },
        {
          isCorrect: false,
          picture: null,
          reason: "That's moving down instead of up.",
          text: "−27 °C",
        },
      ],
      question: "What will the thermometer show?",
      visual: null,
    });

    mockDraft(repeated);
    mockFix({ changedScreens: [7], lesson: written });

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
