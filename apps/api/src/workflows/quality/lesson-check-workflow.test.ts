import { randomUUID } from "node:crypto";
import { writeLessonDraft } from "@zoonk/ai/tasks/lesson-writer";
import { fixLessonDraft } from "@zoonk/ai/tasks/lesson-writer/fix";
import { checkLessonQuality } from "@zoonk/ai/tasks/quality/lesson-check";
import { getPlayableLibraryLesson } from "@zoonk/core/lesson-player/get";
import { completeLessonContent } from "@zoonk/core/library/generation/state";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { chapterLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { sleep } from "workflow";
import { getRun, start } from "workflow/api";
import { mockSession } from "../../../../../packages/core/src/_test-utils/mock-session";
import { writeLessonContent } from "../../../../../packages/core/src/_test-utils/write-lesson-content";
import { recordedLessonFixture } from "../_test-utils/recorded-lesson";
import { recordedOutput, taskResult } from "../_test-utils/recorded-outputs";
import { getStartMock } from "../_test-utils/start-mock";
import { lessonImagesWorkflow } from "../images/lesson-images-workflow";
import { lessonMarksWorkflow } from "../marks/lesson-marks-workflow";
import { type LessonCheckInput, lessonCheckWorkflow } from "./lesson-check-workflow";
import { citePublishedLessonStep } from "./steps/lesson-check-steps";
import type * as CheckSteps from "./steps/lesson-check-steps";

vi.mock("@zoonk/core/users/session", () => ({ getSession: vi.fn() }));

// A step fails for good only after the runtime's retries, which needs the runtime, so the test
// fails the citing step itself.
vi.mock("./steps/lesson-check-steps", async (importOriginal) => ({
  ...(await importOriginal<typeof CheckSteps>()),
  citePublishedLessonStep: vi.fn(),
}));

type RecordedDraft = Awaited<ReturnType<typeof writeLessonDraft>>["data"];

const [recordedSpec] = recordedOutput<{ lessons: object[] }>("lesson-spec").lessons;
const recordedDraft = recordedOutput<RecordedDraft>("lesson-draft");

const wrong = taskResult({
  issues: [
    {
      fix: "Say that vaccines train the immune system without causing the disease.",
      kind: "incorrect" as const,
      problem: "Screen 3 says the vaccine gives a mild case of the disease.",
      screen: 2,
      severity: "blocking" as const,
    },
  ],
});

const FIX = "A vaccine never gives you the disease.";

const fixedDraft: RecordedDraft = {
  ...recordedDraft,
  screens: recordedDraft.screens.map((screen, index) =>
    index === 2 && screen.kind === "explanation"
      ? { ...screen, text: `${screen.text} ${FIX}` }
      : screen,
  ),
};

async function learnersGetTheFix(lessonId: string): Promise<boolean> {
  const played = await getPlayableLibraryLesson({ lessonId });

  if (played?.status !== "ready") {
    throw new Error(`Learners can't play the test lesson: ${played?.status}`);
  }

  return JSON.stringify(played.lesson.steps).includes(FIX);
}

function recordWhatLearnersGetWhileSettling({
  lessonId,
  onSleep,
  running,
}: {
  lessonId: string;
  onSleep: (ms: number) => void;
  running: () => boolean;
}): boolean[] {
  const seen: boolean[] = [];

  const look = async () => {
    seen.push(await learnersGetTheFix(lessonId));
  };

  getStartMock().mockImplementation(async (workflow) => {
    await look();
    return { runId: workflow === lessonMarksWorkflow ? "marks-run" : "pictures-run" } as never;
  });

  vi.mocked(getRun).mockImplementation(
    () =>
      ({
        exists: Promise.resolve(true),
        status: Promise.resolve(running() ? "running" : "completed"),
      }) as never,
  );

  vi.mocked(sleep).mockImplementation(async (ms) => {
    await look();
    onSleep(ms);
  });

  return seen;
}

async function publishedLesson() {
  const workflowRunId = randomUUID();

  const [chapter, user] = await Promise.all([
    libraryChapterFixture({ title: "How vaccines train the immune system" }),
    userFixture(),
  ]);

  const lesson = await recordedLessonFixture({
    contentRunId: workflowRunId,
    contentStatus: "running",
    homeChapterId: chapter.id,
    level: "overview",
    spec: recordedSpec,
    specStatus: "completed",
  });

  const goal = await goalFixture({ userId: user.id });
  const plan = await planFixture({ goalId: goal.id });

  const [item] = await Promise.all([
    planItemFixture({ lessonId: lesson.id, planId: plan.id }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id }),
  ]);

  const written = await writeLessonContent({ forExam: true, lessonId: lesson.id, workflowRunId });

  if (written.status !== "published") {
    throw new Error(`The test lesson wasn't published: ${written.status}`);
  }

  await completeLessonContent({ lessonId: lesson.id, workflowRunId });

  const input: LessonCheckInput = { forExam: true, lessonId: lesson.id, plan: written.check };
  mockSession(user.id);

  return { input, item, lesson };
}

describe(lessonCheckWorkflow, () => {
  beforeEach(() => {
    vi.mocked(writeLessonDraft).mockImplementation(async (params) =>
      taskResult(recordedDraft, params.model ?? "openai/gpt-6-sol"),
    );
  });

  it("leaves a version its reviewer passes as it is, even when citing it keeps failing: citations are extra", async () => {
    const { input } = await publishedLesson();
    vi.mocked(checkLessonQuality).mockResolvedValue(taskResult({ issues: [] }));

    vi.mocked(citePublishedLessonStep).mockRejectedValue(
      new Error(
        'Step "citePublishedLessonStep" failed after 3 retries: The provider is overloaded',
      ),
    );

    await expect(
      lessonCheckWorkflow({ ...input, plan: { ...input.plan, cite: true } }),
    ).resolves.toStrictEqual({ cited: 0, status: "passed" });

    expect(checkLessonQuality).toHaveBeenCalledOnce();
    expect(start).not.toHaveBeenCalled();
  });

  it("tags the fix of what its reviewer found and draws the pictures it lacks, keeping the version learners get until they settle", async () => {
    const { input, lesson } = await publishedLesson();
    vi.mocked(checkLessonQuality).mockResolvedValue(wrong);

    vi.mocked(fixLessonDraft).mockResolvedValue(
      taskResult({ changedScreens: [2], lesson: fixedDraft }),
    );

    let settled = false;

    const seen = recordWhatLearnersGetWhileSettling({
      lessonId: lesson.id,
      onSleep: () => {
        settled = true;
      },
      running: () => !settled,
    });

    await expect(lessonCheckWorkflow(input)).resolves.toStrictEqual({
      cited: 0,
      status: "republished",
    });

    expect(seen).toStrictEqual([false, false, false]);
    await expect(learnersGetTheFix(lesson.id)).resolves.toBe(true);

    const current = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: lesson.id, retiredAt: null },
    });

    expect(current.every((step) => step.version === 2)).toBe(true);

    expect(current[2]?.content).toMatchObject({
      text: expect.stringContaining("A vaccine never gives you the disease."),
    });

    expect(start).toHaveBeenCalledTimes(2);

    expect(start).toHaveBeenCalledWith(lessonImagesWorkflow, [
      { analytics: { contentScope: "shared" }, lessonId: lesson.id },
    ]);

    expect(start).toHaveBeenCalledWith(lessonMarksWorkflow, [{ lessonId: lesson.id }]);
  });

  it("gives learners the fix five minutes after its text even when its pictures never settle", async () => {
    const { input, lesson } = await publishedLesson();
    vi.mocked(checkLessonQuality).mockResolvedValue(wrong);

    vi.mocked(fixLessonDraft).mockResolvedValue(
      taskResult({ changedScreens: [2], lesson: fixedDraft }),
    );

    vi.useFakeTimers({ toFake: ["Date"] });

    onTestFinished(() => {
      vi.useRealTimers();
    });

    const startedAt = Date.now();

    const seen = recordWhatLearnersGetWhileSettling({
      lessonId: lesson.id,
      onSleep: (ms) => {
        vi.setSystemTime(Date.now() + ms + 1000);
      },
      running: () => true,
    });

    await expect(lessonCheckWorkflow(input)).resolves.toMatchObject({ status: "republished" });

    expect(seen).not.toContain(true);
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(5 * 60_000);
    expect(Date.now() - startedAt).toBeLessThanOrEqual(5 * 60_000 + 6000);
    await expect(learnersGetTheFix(lesson.id)).resolves.toBe(true);
  });

  it("drafts a version no fix put right afresh, and takes a wrong one out of play when no draft passes", async () => {
    const { input, item, lesson } = await publishedLesson();
    vi.mocked(checkLessonQuality).mockResolvedValue(wrong);

    vi.mocked(fixLessonDraft).mockImplementation(async (params) =>
      taskResult({ changedScreens: [], lesson: params.lesson }),
    );

    await expect(lessonCheckWorkflow(input)).resolves.toStrictEqual({
      cited: 0,
      status: "setAside",
    });

    const drafts = vi
      .mocked(writeLessonDraft)
      .mock.calls.slice(-2)
      .map(([params]) => params);

    expect(drafts.map((params) => params.heldBackProblems?.length)).toStrictEqual([1, 2]);
    expect(drafts.every((params) => params.serviceTier === "flex")).toBe(true);

    const [stored, planItem, steps] = await Promise.all([
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
      prisma.planItem.findUniqueOrThrow({ where: { id: item.id } }),
      prisma.step.findMany({ where: { lessonId: lesson.id } }),
    ]);

    expect(stored).toMatchObject({ contentStatus: "failed", setAsideAt: expect.any(Date) });
    expect(planItem.status).toBe("skipped");
    expect(steps.every((step) => step.version === 1 && step.retiredAt === null)).toBe(true);
  });
});
