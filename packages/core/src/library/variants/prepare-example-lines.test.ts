import { randomUUID } from "node:crypto";
import { selectRelevantMemoryFacts } from "@zoonk/ai/tasks/memory/relevance";
import { generateExampleLines } from "@zoonk/ai/tasks/variants/example-lines";
import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { toExampleLineClaimTarget } from "./_utils/lesson-example-lines";
import { getStepExampleLine, requestStepExampleLine } from "./get-step-example-line";
import {
  listExampleLineLessons,
  pickExampleLineFactsFor,
  writeLessonExampleLines,
} from "./prepare-example-lines";

const slotContent = {
  exampleLineSlot: { idea: "Waiting for one thing while doing others." },
  text: "`await` pauses only its own function until the result arrives.",
  title: "Await",
};

function mockLines(lines: (string | null)[]) {
  vi.mocked(generateExampleLines).mockResolvedValueOnce({
    data: { lines },
    provenance: {
      generatedAt: new Date().toISOString(),
      latencyMs: 1,
      model: "openai/gpt-6.1-terra",
      promptVersion: "test",
      provider: "test",
      requestedModel: "openai/gpt-6.1-terra",
      runId: randomUUID(),
      usage: {},
    },
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });
}

async function slotLesson({
  contentStatus = "completed",
  content = slotContent,
}: { contentStatus?: "completed" | "pending"; content?: object } = {}) {
  const lesson = await libraryLessonFixture({ contentStatus, language: "en" });
  const step = await libraryStepFixture({ content, lessonId: lesson.id });
  return { lesson, step };
}

async function learnerWhoCooks() {
  const learner = await userFixture();
  await memoryFactFixture({ category: "routine", statement: "Cooks dinner", userId: learner.id });
  return learner;
}

describe(listExampleLineLessons, () => {
  it("keeps plan order and only written lessons that still need this learner's lines", async () => {
    const learner = await learnerWhoCooks();

    const [first, second, noSlot, unwritten, done] = await Promise.all([
      slotLesson(),
      slotLesson(),
      slotLesson({ content: { text: "A plain idea." } }),
      slotLesson({ contentStatus: "pending" }),
      slotLesson(),
    ]);

    const picked = await pickExampleLineFactsFor({
      firstLessonId: done.lesson.id,
      userId: learner.id,
    });

    mockLines(["Already written."]);

    await writeLessonExampleLines({
      lessonId: done.lesson.id,
      picked: picked!,
      userId: learner.id,
    });

    const lessonIds = [second, noSlot, first, unwritten, done].map(({ lesson }) => lesson.id);

    await expect(listExampleLineLessons({ lessonIds, userId: learner.id })).resolves.toStrictEqual([
      second.lesson.id,
      first.lesson.id,
    ]);
  });

  it("lists nothing for a learner who shared nothing", async () => {
    const learner = await userFixture();
    const { lesson } = await slotLesson();

    await expect(
      listExampleLineLessons({ lessonIds: [lesson.id], userId: learner.id }),
    ).resolves.toStrictEqual([]);

    await expect(
      pickExampleLineFactsFor({ firstLessonId: lesson.id, userId: learner.id }),
    ).resolves.toBeNull();
  });

  it("lets a failed relevance check fail the pick, so the step retries instead of using the newest facts", async () => {
    const learner = await userFixture();
    const { lesson } = await slotLesson();

    await Promise.all(
      Array.from({ length: 11 }, (_, index) =>
        memoryFactFixture({ category: "routine", statement: `Hobby ${index}`, userId: learner.id }),
      ),
    );

    vi.mocked(selectRelevantMemoryFacts).mockRejectedValueOnce(new Error("relevance down"));

    await expect(
      pickExampleLineFactsFor({ firstLessonId: lesson.id, userId: learner.id }),
    ).rejects.toThrow("relevance down");
  });

  it("picks nothing, and runs no relevance check, for a learner out of help", async () => {
    const learner = await userFixture();
    const { lesson } = await slotLesson();

    await Promise.all([
      usageRecordsFixture({ count: 100, kind: "assist", userId: learner.id }),
      ...Array.from({ length: 11 }, (_, index) =>
        memoryFactFixture({ category: "routine", statement: `Hobby ${index}`, userId: learner.id }),
      ),
    ]);

    await expect(
      pickExampleLineFactsFor({ firstLessonId: lesson.id, userId: learner.id }),
    ).resolves.toBeNull();

    expect(selectRelevantMemoryFacts).not.toHaveBeenCalled();
  });
});

describe(writeLessonExampleLines, () => {
  it("preserves the target of existing example-line claims", () => {
    expect(
      toExampleLineClaimTarget({
        contextKey: "context",
        lessonId: "lesson",
        userId: "learner",
        version: 2,
      }),
    ).toBe("a23bc65c-3d15-3e10-da53-5e1ef6811ffc");
  });

  it("writes ahead at the background tier, then serves the line when the lesson opens", async () => {
    const learner = await learnerWhoCooks();
    const { lesson, step } = await slotLesson();
    const picked = await pickExampleLineFactsFor({ firstLessonId: lesson.id, userId: learner.id });
    mockLines(["While the pasta water boils, you keep chopping."]);

    await expect(
      writeLessonExampleLines({ lessonId: lesson.id, picked: picked!, userId: learner.id }),
    ).resolves.toBe("written");

    mockSession(learner.id);

    await expect(getStepExampleLine({ stepId: step.id })).resolves.toStrictEqual({
      canRequest: false,
      line: "While the pasta water boils, you keep chopping.",
      status: "ready",
    });

    expect(generateExampleLines).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ facts: ["Cooks dinner"], wait: "later" }),
    );
  });

  it("charges the pick, a retry and the lesson's own request for the same lines once", async () => {
    const learner = await learnerWhoCooks();
    const { lesson, step } = await slotLesson();
    const picked = await pickExampleLineFactsFor({ firstLessonId: lesson.id, userId: learner.id });

    mockLines(["A line."]);
    await writeLessonExampleLines({ lessonId: lesson.id, picked: picked!, userId: learner.id });
    await prisma.stepExampleLine.deleteMany({ where: { userId: learner.id } });

    mockLines(["A line again."]);
    await writeLessonExampleLines({ lessonId: lesson.id, picked: picked!, userId: learner.id });
    await prisma.stepExampleLine.deleteMany({ where: { userId: learner.id } });

    mockSession(learner.id);
    mockLines(["A line asked for in the lesson."]);
    await requestStepExampleLine({ stepId: step.id });

    await expect(
      prisma.usageRecord.count({ where: { kind: "assist", userId: learner.id } }),
    ).resolves.toBe(1);
  });

  it("writes nothing when what the learner shared changed after the pick", async () => {
    const learner = await learnerWhoCooks();
    const { lesson } = await slotLesson();
    const picked = await pickExampleLineFactsFor({ firstLessonId: lesson.id, userId: learner.id });

    await memoryFactFixture({
      category: "background",
      statement: "Rides a bike",
      userId: learner.id,
    });

    await expect(
      writeLessonExampleLines({ lessonId: lesson.id, picked: picked!, userId: learner.id }),
    ).resolves.toBe("skipped");

    expect(generateExampleLines).not.toHaveBeenCalled();
  });
});
