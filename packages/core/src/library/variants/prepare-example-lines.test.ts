import { randomUUID } from "node:crypto";
import { generateExampleLines } from "@zoonk/ai/tasks/variants/example-lines";
import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getStepExampleLine } from "./get-step-example-line";
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

    const picked = await pickExampleLineFactsFor({ userId: learner.id });
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

    await expect(pickExampleLineFactsFor({ userId: learner.id })).resolves.toBeNull();
  });
});

describe(writeLessonExampleLines, () => {
  it("writes ahead at the background tier, then serves the line when the lesson opens", async () => {
    const learner = await learnerWhoCooks();
    const { lesson, step } = await slotLesson();
    const picked = await pickExampleLineFactsFor({ userId: learner.id });
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

  it("charges a retry of the same lesson and context once", async () => {
    const learner = await learnerWhoCooks();
    const { lesson } = await slotLesson();
    const picked = await pickExampleLineFactsFor({ userId: learner.id });

    mockLines(["A line."]);
    await writeLessonExampleLines({ lessonId: lesson.id, picked: picked!, userId: learner.id });
    await prisma.stepExampleLine.deleteMany({ where: { userId: learner.id } });

    mockLines(["A line again."]);
    await writeLessonExampleLines({ lessonId: lesson.id, picked: picked!, userId: learner.id });

    await expect(
      prisma.usageRecord.count({ where: { kind: "assist", userId: learner.id } }),
    ).resolves.toBe(1);
  });

  it("writes nothing when what the learner shared changed after the pick", async () => {
    const learner = await learnerWhoCooks();
    const { lesson } = await slotLesson();
    const picked = await pickExampleLineFactsFor({ userId: learner.id });

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
