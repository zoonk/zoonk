import { generateLessonSpec } from "@zoonk/ai/tasks/v2/lesson-spec";
import { writeLessonDraft } from "@zoonk/ai/tasks/v2/lesson-writer";
import { fixLessonDraft } from "@zoonk/ai/tasks/v2/lesson-writer/fix";
import { checkLessonQuality } from "@zoonk/ai/tasks/v2/quality/lesson-check";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  heldBackDraftFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStreamedEvents } from "../../_test-utils/parse-stream-events";
import { recordedOutput, taskResult } from "../_test-utils/recorded-outputs";
import { lessonContentWorkflow } from "./lesson-content-workflow";
import type * as LessonWriter from "@zoonk/ai/tasks/v2/lesson-writer";

vi.mock("workflow/api", () => ({
  getRun: vi.fn(() => ({ exists: Promise.resolve(false), status: Promise.resolve("failed") })),
  start: vi.fn(() => Promise.resolve({ runId: "started-run" })),
}));

// Model calls are external: tests replay a real spec and draft recorded for the same lesson. The
// writer's model choice for a last draft runs for real.
vi.mock("@zoonk/ai/tasks/v2/lesson-spec", () => ({ generateLessonSpec: vi.fn() }));

vi.mock("@zoonk/ai/tasks/v2/lesson-writer", async (importOriginal) => ({
  ...(await importOriginal<typeof LessonWriter>()),
  writeLessonDraft: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/v2/lesson-writer/fix", () => ({ fixLessonDraft: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/quality/lesson-check", () => ({ checkLessonQuality: vi.fn() }));

type RecordedSpec = Awaited<ReturnType<typeof generateLessonSpec>>["data"];
type RecordedDraft = Awaited<ReturnType<typeof writeLessonDraft>>["data"];

const recordedSpec = recordedOutput<RecordedSpec>("lesson-spec");
const recordedDraft = recordedOutput<RecordedDraft>("lesson-draft");

const SOL = "openai/gpt-6-sol";
const OPUS = "anthropic/claude-opus-5.5";

/**
 * A draft its code checks hold back: filler on screen 2, which the fix pass (replaying the draft)
 * leaves as it was.
 */
const heldBack: RecordedDraft = {
  ...recordedDraft,
  screens: recordedDraft.screens.map((screen, index) =>
    index === 2 && screen.kind === "explanation"
      ? { ...screen, text: `It's worth noting that ${screen.text}` }
      : screen,
  ),
};

/** The writer's drafts in order: held back ones, then the recorded draft once they run out. */
function mockDrafts(held: number) {
  Array.from({ length: held }).forEach(() =>
    vi
      .mocked(writeLessonDraft)
      .mockImplementationOnce(async (params) => taskResult(heldBack, params.model ?? SOL)),
  );
}

/** A lesson of a learner's plan, its spec already written (reasoning check on, as for exams). */
async function plannedLesson(attrs: Parameters<typeof libraryLessonFixture>[0] = {}) {
  const [chapter, user] = await Promise.all([
    libraryChapterFixture({ title: "How vaccines train the immune system" }),
    userFixture(),
  ]);

  const lesson = await libraryLessonFixture({
    homeChapterId: chapter.id,
    level: "overview",
    spec: recordedSpec.lessons[0],
    specStatus: "completed",
    ...attrs,
  });

  const goal = await goalFixture({ userId: user.id });
  const plan = await planFixture({ goalId: goal.id });

  const [item] = await Promise.all([
    planItemFixture({ lessonId: lesson.id, planId: plan.id }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id }),
  ]);

  return { item, lesson };
}

function writeSteps() {
  return getStreamedEvents()
    .filter((event) => event.step === "writeLesson")
    .map((event) => String(event.status));
}

describe("lesson content redrafts", () => {
  beforeEach(() => {
    vi.mocked(generateLessonSpec).mockResolvedValue(taskResult(recordedSpec));

    vi.mocked(writeLessonDraft).mockImplementation(async (params) =>
      taskResult(recordedDraft, params.model ?? SOL),
    );

    vi.mocked(fixLessonDraft).mockResolvedValue(
      taskResult({ changedScreens: [2], lesson: heldBack }),
    );
  });

  it("drafts a lesson its checks held back again in the same run, told why, and publishes it", async () => {
    const { lesson } = await plannedLesson();
    mockDrafts(1);

    await expect(
      lessonContentWorkflow({ forExam: true, lessonId: lesson.id }),
    ).resolves.toStrictEqual({ lessonId: lesson.id, status: "ready" });

    expect(writeLessonDraft).toHaveBeenCalledTimes(2);

    // The reviewer reads the published lesson in the background, never on the way to it.
    expect(checkLessonQuality).not.toHaveBeenCalled();

    expect(vi.mocked(writeLessonDraft).mock.calls[1]?.[0]).toMatchObject({
      heldBackProblems: [expect.objectContaining({ screen: 2 })],
      model: undefined,
    });

    expect(writeSteps()).toStrictEqual(["started", "completed", "started", "completed"]);

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
    ).resolves.toMatchObject({ contentStatus: "completed", heldBackDrafts: [], setAsideAt: null });
  });

  it("gives the last draft to another family's writer, then sets the lesson aside and the plan moves on", async () => {
    const { item, lesson } = await plannedLesson();
    mockDrafts(3);

    await expect(
      lessonContentWorkflow({ forExam: true, lessonId: lesson.id }),
    ).resolves.toStrictEqual({ lessonId: lesson.id, status: "heldBack" });

    expect(vi.mocked(writeLessonDraft).mock.calls.map(([params]) => params.model)).toStrictEqual([
      undefined,
      undefined,
      OPUS,
    ]);

    const [stored, planItem] = await Promise.all([
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
      prisma.planItem.findUniqueOrThrow({ where: { id: item.id } }),
    ]);

    expect(stored.contentStatus).toBe("failed");
    expect(stored.setAsideAt).toBeInstanceOf(Date);
    expect(stored.heldBackDrafts).toHaveLength(3);
    expect(planItem.status).toBe("skipped");

    expect(getStreamedEvents().at(-1)).toMatchObject({ status: "error", step: "workflowError" });
  });

  it("finishes the drafts an earlier run left: a lesson held back once gets two more", async () => {
    const { lesson } = await plannedLesson({
      contentStatus: "failed",
      heldBackDrafts: [heldBackDraftFixture({ model: SOL })],
    });

    mockDrafts(2);

    await expect(
      lessonContentWorkflow({ forExam: true, lessonId: lesson.id }),
    ).resolves.toMatchObject({ status: "heldBack" });

    expect(vi.mocked(writeLessonDraft).mock.calls.map(([params]) => params.model)).toStrictEqual([
      undefined,
      OPUS,
    ]);
  });

  it("never writes a lesson set aside after its last draft", async () => {
    const { lesson } = await plannedLesson({
      contentStatus: "failed",
      heldBackDrafts: [heldBackDraftFixture(), heldBackDraftFixture(), heldBackDraftFixture()],
      setAsideAt: new Date(),
    });

    await expect(lessonContentWorkflow({ lessonId: lesson.id })).resolves.toStrictEqual({
      lessonId: lesson.id,
      status: "heldBack",
    });

    expect(writeLessonDraft).not.toHaveBeenCalled();

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
    ).resolves.toMatchObject({ contentStatus: "failed", heldBackDrafts: expect.any(Array) });
  });
});
