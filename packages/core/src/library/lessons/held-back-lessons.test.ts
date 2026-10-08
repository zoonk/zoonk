import { randomUUID } from "node:crypto";
import { writeLessonDraft } from "@zoonk/ai/tasks/v2/lesson-writer";
import { fixLessonDraft } from "@zoonk/ai/tasks/v2/lesson-writer/fix";
import { checkLessonQuality } from "@zoonk/ai/tasks/v2/quality/lesson-check";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import {
  heldBackDraftFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { claimLibraryGeneration } from "../claims/generation-claim";
import { temperatureSpec, writtenTemperatureLesson } from "../quality/_test-utils/written-lessons";
import { writeLessonContent } from "./write-lesson-content";
import type * as LessonWriter from "@zoonk/ai/tasks/v2/lesson-writer";

/** Model calls are the external boundary; the writer's model choice, checks and storage run for real. */
vi.mock("@zoonk/ai/tasks/v2/lesson-writer", async (importOriginal) => ({
  ...(await importOriginal<typeof LessonWriter>()),
  writeLessonDraft: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/v2/lesson-writer/fix", () => ({ fixLessonDraft: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/quality/lesson-check", () => ({ checkLessonQuality: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/material/cite", () => ({ citeMaterial: vi.fn() }));

const SOL = "openai/gpt-6-sol";
const OPUS = "anthropic/claude-opus-5.5";
const GEMINI = "google/gemini-3.8-flash";

function taskResult<T>(data: T, model: string) {
  return {
    data,
    provenance: {
      generatedAt: new Date().toISOString(),
      latencyMs: 1,
      model,
      promptVersion: "test-prompt",
      provider: "test",
      requestedModel: model,
      runId: randomUUID(),
      usage: {},
    },
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  };
}

/** Filler the code checks flag on screen 4, which the fix pass in these tests leaves as it was. */
const FILLER = "It's worth noting that zero is a mark.";

/**
 * One draft by `model`. A `heldBack` draft has filler the code checks flag, and its fix pass
 * leaves it, so the checks hold the draft back.
 */
function mockDraft({ heldBack, model }: { heldBack: boolean; model: string }) {
  const written = writtenTemperatureLesson();

  const lesson = heldBack
    ? {
        ...written,
        screens: written.screens.map((screen, index) =>
          index === 4 && screen.kind === "explanation" ? { ...screen, text: FILLER } : screen,
        ),
      }
    : written;

  vi.mocked(writeLessonDraft).mockResolvedValueOnce(taskResult(lesson, model));

  if (heldBack) {
    vi.mocked(fixLessonDraft).mockResolvedValueOnce(
      taskResult({ changedScreens: [], lesson }, SOL),
    );
  }
}

async function claimedLesson(attrs: Parameters<typeof libraryLessonFixture>[0] = {}) {
  const workflowRunId = randomUUID();
  const skill = await skillFixture({ name: "Add a rise to a temperature below zero" });

  const lesson = await libraryLessonFixture({
    contentRunId: workflowRunId,
    contentStatus: "running",
    spec: temperatureSpec(),
    specStatus: "completed",
    ...attrs,
  });

  await lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id });

  return { lesson, workflowRunId };
}

/** A learner's plan with the lesson and another one, and today's and yesterday's sessions. */
async function plannedLesson(lessonId: string) {
  const user = await userFixture();
  const goal = await goalFixture({ userId: user.id });
  const plan = await planFixture({ goalId: goal.id });
  const other = await libraryLessonFixture({ contentStatus: "completed" });

  const [today, yesterday, item, otherItem] = await Promise.all([
    studySessionFixture({ goalId: goal.id, userId: user.id }),
    studySessionFixture({
      goalId: goal.id,
      localDate: new Date(Date.UTC(2026, 0, 1)),
      status: "completed",
      userId: user.id,
    }),
    planItemFixture({ lessonId, planId: plan.id, position: 0 }),
    planItemFixture({ lessonId: other.id, planId: plan.id, position: 1 }),
  ]);

  const [block, nextBlock, pastBlock] = await Promise.all([
    studySessionBlockFixture({ lessonId, position: 0, sessionId: today.id }),
    studySessionBlockFixture({ lessonId: other.id, position: 1, sessionId: today.id }),
    studySessionBlockFixture({ lessonId, position: 0, sessionId: yesterday.id }),
  ]);

  return { block, item, nextBlock, otherItem, pastBlock };
}

async function redraft({ lessonId, workflowRunId }: { lessonId: string; workflowRunId: string }) {
  await expect(
    claimLibraryGeneration({ id: lessonId, target: "lessonContent", workflowRunId }),
  ).resolves.toBe("claimed");

  return writeLessonContent({ lessonId, workflowRunId });
}

function readLesson(lessonId: string) {
  return prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } });
}

describe("held-back lessons", () => {
  it("drafts a held-back lesson again with its findings, then with another family's writer, then sets it aside so plans move on", async () => {
    const { lesson, workflowRunId } = await claimedLesson();
    const planned = await plannedLesson(lesson.id);

    mockDraft({ heldBack: true, model: SOL });

    await expect(writeLessonContent({ lessonId: lesson.id, workflowRunId })).resolves.toMatchObject(
      { status: "heldBack" },
    );

    const first = await readLesson(lesson.id);

    expect(first).toMatchObject({
      contentStatus: "failed",
      heldBackDrafts: [
        {
          model: SOL,
          problems: [{ problem: expect.any(String), screen: 4 }],
          runId: workflowRunId,
        },
      ],
      setAsideAt: null,
    });

    // The second draft: a fresh one by the same writer, told what held the first back.
    mockDraft({ heldBack: true, model: SOL });
    await redraft({ lessonId: lesson.id, workflowRunId });

    expect(vi.mocked(writeLessonDraft).mock.calls[1]?.[0]).toMatchObject({
      heldBackProblems: [expect.objectContaining({ screen: 4 })],
      model: undefined,
    });

    await expect(readLesson(lesson.id)).resolves.toMatchObject({
      contentStatus: "failed",
      setAsideAt: null,
    });

    // The last draft: a writer from another family, told what held both back.
    mockDraft({ heldBack: true, model: OPUS });
    await redraft({ lessonId: lesson.id, workflowRunId });

    const lastDraft = vi.mocked(writeLessonDraft).mock.calls[2]?.[0];
    expect(lastDraft?.model).toBe(OPUS);
    expect(lastDraft?.heldBackProblems).toHaveLength(2);

    // The reviewer reads drafts after publishing, so none ran on the way to the learner.
    expect(checkLessonQuality).not.toHaveBeenCalled();

    const setAside = await readLesson(lesson.id);
    expect(setAside.contentStatus).toBe("failed");
    expect(setAside.setAsideAt).toBeInstanceOf(Date);
    expect(setAside.heldBackDrafts).toHaveLength(3);

    const [item, otherItem, block, nextBlock, pastBlock] = await Promise.all([
      prisma.planItem.findUniqueOrThrow({ where: { id: planned.item.id } }),
      prisma.planItem.findUniqueOrThrow({ where: { id: planned.otherItem.id } }),
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: planned.block.id } }),
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: planned.nextBlock.id } }),
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: planned.pastBlock.id } }),
    ]);

    // Plans and today's session move on; the rest of the plan and a finished day stay as they are.
    expect([item.status, otherItem.status]).toStrictEqual(["skipped", "todo"]);

    expect([block.status, nextBlock.status, pastBlock.status]).toStrictEqual([
      "skipped",
      "pending",
      "pending",
    ]);
  });

  it("gives a private lesson's last draft to Sol when Gemini wrote the held-back ones", async () => {
    const user = await userFixture();

    const { lesson, workflowRunId } = await claimedLesson({
      heldBackDrafts: [
        heldBackDraftFixture({ model: GEMINI }),
        heldBackDraftFixture({ model: GEMINI }),
      ],
      ownerId: user.id,
      visibility: "private",
    });

    mockDraft({ heldBack: false, model: SOL });

    await writeLessonContent({ lessonId: lesson.id, model: GEMINI, workflowRunId });

    expect(vi.mocked(writeLessonDraft).mock.calls[0]?.[0].model).toBe(SOL);
  });

  it("clears the held-back drafts when a later draft is published", async () => {
    const { lesson, workflowRunId } = await claimedLesson({
      contentStatus: "running",
      heldBackDrafts: [heldBackDraftFixture()],
    });

    mockDraft({ heldBack: false, model: SOL });

    await expect(writeLessonContent({ lessonId: lesson.id, workflowRunId })).resolves.toMatchObject(
      { status: "published" },
    );

    expect(vi.mocked(writeLessonDraft).mock.calls[0]?.[0].heldBackProblems).toStrictEqual([
      { problem: "The option marked correct is wrong.", screen: 3 },
    ]);

    await expect(readLesson(lesson.id)).resolves.toMatchObject({
      contentStatus: "completed",
      heldBackDrafts: [],
      setAsideAt: null,
    });
  });
});
