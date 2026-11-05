import { randomUUID } from "node:crypto";
import { generateLessonIconImage } from "@zoonk/ai/tasks/icons/image";
import { matchLessonIcons } from "@zoonk/ai/tasks/icons/match";
import { tagLesson } from "@zoonk/ai/tasks/lesson-marks";
import { uploadImage } from "@zoonk/core/images/upload";
import { readSavedLessonMap } from "@zoonk/core/library/lessons/map";
import { prisma } from "@zoonk/db";
import { lessonIconFixture, playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sleep } from "workflow";
import { drawnIcon } from "./_test-utils/icon-results";
import { lessonMarksWorkflow } from "./lesson-marks-workflow";

const ideas = [
  { label: "A cloud", text: "The electron spreads around the nucleus as a cloud." },
  { label: "Reading it", text: "The darker the cloud, the likelier the electron is there." },
];

function randomWord() {
  return `zq${randomUUID().replaceAll(/[\d-]/gu, "").slice(0, 8)}`;
}

/** Words no other test's icon has, so the library search finds nothing to reuse. */
function uniqueName() {
  return `${randomWord()} ${randomWord()}`;
}

function need(name: string) {
  return { description: `A drawing of a ${name}`, name, searchWords: [] };
}

function taggedAs({ cloud, nucleus }: { cloud: string; nucleus: string }) {
  vi.mocked(tagLesson).mockImplementation(async ({ screens }) => ({
    data: {
      ideas: [
        { about: "What the electron does", icon: need(cloud) },
        { about: "How to read the cloud", icon: need(nucleus) },
      ],
      screens: screens.map(() => ({
        example: null,
        icon: need(cloud),
        ideaIndex: 0,
        underline: null,
      })),
    },
    output: {} as never,
    provenance: {} as never,
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  }));
}

async function markedLesson() {
  const { lesson } = await playableLessonFixture({
    lesson: { summary: { ideas, shape: "hub" } },
    steps: ["explanation", "explanation"],
  });

  return lesson;
}

async function linkedIcons(lessonId: string) {
  const [steps, lesson] = await Promise.all([
    prisma.step.findMany({
      orderBy: { position: "asc" },
      select: { marks: true },
      where: { lessonId },
    }),
    prisma.lesson.findUniqueOrThrow({ select: { summary: true }, where: { id: lessonId } }),
  ]);

  return {
    ideas: (readSavedLessonMap(lesson.summary)?.ideas ?? []).map(({ iconId, iconPending }) => ({
      iconId,
      iconPending,
    })),
    steps: steps.map((step) => step.marks),
  };
}

describe(lessonMarksWorkflow, () => {
  beforeEach(() => {
    vi.mocked(generateLessonIconImage).mockResolvedValue(drawnIcon as never);

    vi.mocked(uploadImage).mockImplementation(({ fileName }) =>
      Promise.resolve({ data: `https://blob.test/${randomUUID()}/${fileName}`, error: null }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("tags a written lesson, draws each new icon once in its own step and links it to every screen and idea", async () => {
    const [cloud, nucleus] = [uniqueName(), uniqueName()];
    taggedAs({ cloud, nucleus });
    const lesson = await markedLesson();

    await expect(lessonMarksWorkflow({ lessonId: lesson.id })).resolves.toStrictEqual({
      drawn: 2,
      failed: 0,
      icons: 2,
    });

    expect(tagLesson).toHaveBeenCalledOnce();
    expect(matchLessonIcons).not.toHaveBeenCalled();

    expect(
      vi
        .mocked(generateLessonIconImage)
        .mock.calls.map(([input]) => input.need.name)
        .toSorted(),
    ).toStrictEqual([cloud, nucleus].toSorted());

    const icons = await prisma.lessonIcon.findMany({ where: { name: { in: [cloud, nucleus] } } });
    const idOf = (name: string) => icons.find((icon) => icon.name === name)?.id;

    expect(icons.every((icon) => icon.status === "completed" && icon.url && icon.smallUrl)).toBe(
      true,
    );

    await expect(linkedIcons(lesson.id)).resolves.toMatchObject({
      ideas: [
        { iconId: idOf(cloud), iconPending: false },
        { iconId: idOf(nucleus), iconPending: false },
      ],
      steps: [
        { iconId: idOf(cloud), iconPending: false },
        { iconId: idOf(cloud), iconPending: false },
      ],
    });
  });

  it("records an icon whose drawing keeps failing, so no lesson pays for it again, and still links the others", async () => {
    const [cloud, nucleus] = [uniqueName(), uniqueName()];
    taggedAs({ cloud, nucleus });
    const lesson = await markedLesson();

    vi.mocked(generateLessonIconImage).mockImplementation(async ({ need: asked }) => {
      if (asked.name === nucleus) {
        throw new Error("Your request was rejected by the safety system");
      }

      return drawnIcon as never;
    });

    await expect(lessonMarksWorkflow({ lessonId: lesson.id })).resolves.toStrictEqual({
      drawn: 1,
      failed: 1,
      icons: 2,
    });

    await expect(
      prisma.lessonIcon.findUniqueOrThrow({ where: { name: nucleus } }),
    ).resolves.toMatchObject({ status: "failed" });

    await expect(linkedIcons(lesson.id)).resolves.toMatchObject({
      ideas: [{ iconPending: false }, { iconId: null, iconPending: false }],
      steps: [{ iconPending: false }, { iconPending: false }],
    });
  });

  it("waits for an icon another lesson's run is drawing instead of drawing it again, then links it", async () => {
    const [cloud, nucleus] = [uniqueName(), uniqueName()];
    taggedAs({ cloud, nucleus });
    const lesson = await markedLesson();

    const drawing = await lessonIconFixture({
      name: cloud,
      runId: "another-lesson-run",
      smallUrl: null,
      status: "running",
      url: null,
    });

    vi.mocked(sleep).mockImplementationOnce(async () => {
      await prisma.lessonIcon.update({
        data: {
          smallUrl: "https://blob.test/96.webp",
          status: "completed",
          url: "https://blob.test/256.webp",
        },
        where: { id: drawing.id },
      });
    });

    await expect(lessonMarksWorkflow({ lessonId: lesson.id })).resolves.toStrictEqual({
      drawn: 1,
      failed: 0,
      icons: 2,
    });

    expect(
      vi.mocked(generateLessonIconImage).mock.calls.map(([input]) => input.need.name),
    ).toStrictEqual([nucleus]);

    await expect(linkedIcons(lesson.id)).resolves.toMatchObject({
      steps: [
        { iconId: drawing.id, iconPending: false },
        { iconId: drawing.id, iconPending: false },
      ],
    });
  });

  it("draws an icon itself when the run that claimed it stopped, once its claim is stale", async () => {
    const [cloud, nucleus] = [uniqueName(), uniqueName()];
    taggedAs({ cloud, nucleus });
    const lesson = await markedLesson();

    const stopped = await lessonIconFixture({
      name: cloud,
      runId: "a-run-that-stopped",
      smallUrl: null,
      status: "running",
      url: null,
    });

    vi.useFakeTimers({ toFake: ["Date"] });

    vi.mocked(sleep).mockImplementation(async () => {
      vi.setSystemTime(Date.now() + 60_000);
    });

    await expect(lessonMarksWorkflow({ lessonId: lesson.id })).resolves.toStrictEqual({
      drawn: 2,
      failed: 0,
      icons: 2,
    });

    await expect(
      prisma.lessonIcon.findUniqueOrThrow({ where: { id: stopped.id } }),
    ).resolves.toMatchObject({ runId: "test-run-id", status: "completed" });

    await expect(linkedIcons(lesson.id)).resolves.toMatchObject({
      steps: [
        { iconId: stopped.id, iconPending: false },
        { iconId: stopped.id, iconPending: false },
      ],
    });
  });

  it("waits again when another lesson's run retakes the stalled icon first, then links it", async () => {
    const [cloud, nucleus] = [uniqueName(), uniqueName()];
    taggedAs({ cloud, nucleus });
    const lesson = await markedLesson();

    const stalled = await lessonIconFixture({
      name: cloud,
      runId: "a-run-that-stopped",
      smallUrl: null,
      status: "running",
      url: null,
    });

    vi.useFakeTimers({ toFake: ["Date"] });
    let sleeps = 0;

    vi.mocked(sleep).mockImplementation(async () => {
      sleeps += 1;
      vi.setSystemTime(Date.now() + 60_000);

      if (sleeps === 66) {
        await prisma.lessonIcon.update({
          data: { runId: "another-lesson-run", updatedAt: new Date() },
          where: { id: stalled.id },
        });
      }

      if (sleeps === 67) {
        await prisma.lessonIcon.update({
          data: {
            smallUrl: "https://blob.test/96.webp",
            status: "completed",
            url: "https://blob.test/256.webp",
          },
          where: { id: stalled.id },
        });
      }
    });

    await lessonMarksWorkflow({ lessonId: lesson.id });

    expect(
      vi.mocked(generateLessonIconImage).mock.calls.map(([input]) => input.need.name),
    ).toStrictEqual([nucleus]);

    await expect(linkedIcons(lesson.id)).resolves.toMatchObject({
      steps: [
        { iconId: stalled.id, iconPending: false },
        { iconId: stalled.id, iconPending: false },
      ],
    });
  });
});
