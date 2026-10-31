import { prisma } from "@zoonk/db";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { numberedCheckContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { setupPlayableLesson } from "./_test-utils/playable-lesson-setup";
import { checkLessonStep } from "./check-lesson-step";
import { completeLibraryLesson } from "./complete-library-lesson";
import { startLibraryLesson } from "./start-library-lesson";

const NOW = new Date("2026-10-13T12:00:00.000Z");
const MINUTE_MS = 60_000;
const TIME_ZONE = "UTC";

function minutesFromNow(minutes: number): Date {
  return new Date(NOW.getTime() + minutes * MINUTE_MS);
}

async function runWithNumberedQuestion({ writtenAgo }: { writtenAgo: number }) {
  const setup = await setupPlayableLesson({
    steps: ["check", { content: numberedCheckContent, kind: "check" }],
  });

  const [first, numbered] = setup.steps;

  await prisma.step.update({
    data: { generatedAt: minutesFromNow(-writtenAgo), updatedAt: minutesFromNow(-writtenAgo) },
    where: { id: numbered?.id },
  });

  const started = await startLibraryLesson({
    input: { timeZone: TIME_ZONE },
    lessonId: setup.lesson.id,
  });

  const runId = started.status === "started" ? started.run.runId : "";

  await checkLessonStep({
    input: {
      answer: { kind: "check", optionId: "likely" },
      durationMs: 5000,
      runId,
      timeZone: TIME_ZONE,
    },
    stepId: first?.id ?? "",
  });

  async function drawPicture(minutes: number) {
    const asset = await mediaAssetFixture({ height: 1024, width: 1024 });

    await prisma.step.update({
      data: {
        mediaAssetId: asset.id,
        pictureAvailableAt: minutesFromNow(minutes),
        updatedAt: minutesFromNow(minutes),
      },
      where: { id: numbered?.id },
    });
  }

  const complete = () =>
    completeLibraryLesson({ input: { runId, timeZone: TIME_ZONE }, lessonId: setup.lesson.id });

  return { complete, drawPicture, numbered, runId, setup };
}

describe("a question whose numbered picture was missing during the run", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("is optional in that run once its picture comes after its wait, so the lesson finishes without it", async () => {
    const { complete, drawPicture } = await runWithNumberedQuestion({ writtenAgo: 10 });

    await drawPicture(2);
    vi.setSystemTime(minutesFromNow(3));

    await expect(complete()).resolves.toMatchObject({
      completion: { correctCount: 1, incorrectCount: 0 },
      status: "completed",
    });
  });

  it("is asked when its picture came within its wait, which the player waits for", async () => {
    const { complete, drawPicture } = await runWithNumberedQuestion({ writtenAgo: 1 });

    await drawPicture(2);
    vi.setSystemTime(minutesFromNow(3));

    await expect(complete()).resolves.toStrictEqual({ status: "invalid" });
  });

  it("is asked in a run that started with its picture there", async () => {
    const { complete, drawPicture } = await runWithNumberedQuestion({ writtenAgo: 10 });

    await drawPicture(-1);

    await expect(complete()).resolves.toStrictEqual({ status: "invalid" });
  });

  it("still requires a question that had its picture when an ordinary citation update arrives during the run", async () => {
    const { complete, drawPicture, numbered, runId } = await runWithNumberedQuestion({
      writtenAgo: 10,
    });

    await drawPicture(-1);
    vi.setSystemTime(minutesFromNow(2));
    await prisma.step.update({ data: { sourcePage: 2 }, where: { id: numbered?.id } });
    await expect(complete()).resolves.toStrictEqual({ status: "invalid" });

    await expect(
      prisma.learningEvent.findUniqueOrThrow({ where: { id: runId } }),
    ).resolves.toMatchObject({ endedAt: null });
  });

  it("keeps historical image links required when their availability wasn't recorded", async () => {
    const { complete, drawPicture, numbered } = await runWithNumberedQuestion({ writtenAgo: 10 });
    await drawPicture(-1);
    vi.setSystemTime(minutesFromNow(2));

    await prisma.step.update({
      data: { pictureAvailableAt: null, sourcePage: 2 },
      where: { id: numbered?.id },
    });

    await expect(complete()).resolves.toStrictEqual({ status: "invalid" });
  });

  it("derives optional questions from the retired version the learner is still playing", async () => {
    const { complete, drawPicture, numbered, runId, setup } = await runWithNumberedQuestion({
      writtenAgo: 10,
    });

    await drawPicture(2);
    vi.setSystemTime(minutesFromNow(3));

    await prisma.step.updateMany({
      data: { retiredAt: new Date() },
      where: { lessonId: setup.lesson.id },
    });

    await prisma.step.createMany({
      data: setup.steps.map((step) => ({
        ...step,
        content: step.content ?? {},
        id: crypto.randomUUID(),
        pictureAvailableAt: null,
        retiredAt: null,
        version: 2,
      })),
    });

    await expect(
      startLibraryLesson({ input: { timeZone: TIME_ZONE }, lessonId: setup.lesson.id }),
    ).resolves.toMatchObject({
      run: { answers: [{ stepId: setup.steps[0]?.id }], optionalStepIds: [numbered?.id], runId },
      status: "started",
    });

    await expect(complete()).resolves.toMatchObject({ status: "completed" });
  });

  it("keeps a truly late picture optional on a same-run reload, then asks it in a new run", async () => {
    const { drawPicture, numbered, runId, setup } = await runWithNumberedQuestion({
      writtenAgo: 10,
    });

    await drawPicture(2);
    vi.setSystemTime(minutesFromNow(3));

    await expect(
      startLibraryLesson({ input: { timeZone: TIME_ZONE }, lessonId: setup.lesson.id }),
    ).resolves.toMatchObject({
      run: { optionalStepIds: [numbered?.id], runId },
      status: "started",
    });

    vi.setSystemTime(minutesFromNow(31));

    const restarted = await startLibraryLesson({
      input: { timeZone: TIME_ZONE },
      lessonId: setup.lesson.id,
    });

    expect(restarted).toMatchObject({ run: { optionalStepIds: [] }, status: "started" });
    expect(restarted.status === "started" && restarted.run.runId).not.toBe(runId);

    await expect(
      completeLibraryLesson({
        input: {
          runId: restarted.status === "started" ? restarted.run.runId : "",
          timeZone: TIME_ZONE,
        },
        lessonId: setup.lesson.id,
      }),
    ).resolves.toStrictEqual({ status: "invalid" });
  });

  it.each([1, 10])(
    "refreshes the original run after a long pause, with a picture written %s minutes earlier",
    async (writtenAgo) => {
      const { drawPicture, numbered, runId, setup } = await runWithNumberedQuestion({ writtenAgo });
      await drawPicture(2);
      vi.setSystemTime(minutesFromNow(31));

      await expect(
        startLibraryLesson({ input: { runId, timeZone: TIME_ZONE }, lessonId: setup.lesson.id }),
      ).resolves.toMatchObject({
        run: { optionalStepIds: writtenAgo === 10 ? [numbered?.id] : [], runId },
        status: "started",
      });
    },
  );

  it("refuses another learner's run without starting a replacement", async () => {
    const { runId, setup } = await runWithNumberedQuestion({ writtenAgo: 10 });
    const other = await userFixture();
    mockSession(other.id);

    await expect(
      startLibraryLesson({ input: { runId, timeZone: TIME_ZONE }, lessonId: setup.lesson.id }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expect(prisma.learningEvent.count({ where: { userId: other.id } })).resolves.toBe(0);
  });

  it("never refreshes a finished run as a new sitting", async () => {
    const { complete, drawPicture, runId, setup } = await runWithNumberedQuestion({
      writtenAgo: 10,
    });

    await drawPicture(2);
    vi.setSystemTime(minutesFromNow(3));
    await expect(complete()).resolves.toMatchObject({ status: "completed" });

    await expect(
      startLibraryLesson({ input: { runId, timeZone: TIME_ZONE }, lessonId: setup.lesson.id }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expect(prisma.learningEvent.count({ where: { userId: setup.user.id } })).resolves.toBe(1);
  });

  it("refreshes the retained run when background review takes its lesson out of play", async () => {
    const { complete, drawPicture, runId, setup } = await runWithNumberedQuestion({
      writtenAgo: 1,
    });

    await drawPicture(2);
    vi.setSystemTime(minutesFromNow(31));

    await Promise.all([
      prisma.lesson.update({ data: { contentStatus: "failed" }, where: { id: setup.lesson.id } }),
      prisma.step.updateMany({
        data: { retiredAt: new Date() },
        where: { lessonId: setup.lesson.id },
      }),
    ]);

    await expect(
      startLibraryLesson({ input: { runId, timeZone: TIME_ZONE }, lessonId: setup.lesson.id }),
    ).resolves.toMatchObject({
      run: { answers: [{ stepId: setup.steps[0]?.id }], optionalStepIds: [], runId },
      status: "started",
    });

    await expect(
      startLibraryLesson({ input: { timeZone: TIME_ZONE }, lessonId: setup.lesson.id }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expect(complete()).resolves.toStrictEqual({ status: "invalid" });
  });
});
