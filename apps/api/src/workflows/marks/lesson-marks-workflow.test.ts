import { randomUUID } from "node:crypto";
import { generateLessonIconImage } from "@zoonk/ai/tasks/icons/image";
import { matchLessonIcons } from "@zoonk/ai/tasks/icons/match";
import { tagLesson } from "@zoonk/ai/tasks/lesson-marks";
import { uploadImage } from "@zoonk/core/images/upload";
import { readSavedLessonMap } from "@zoonk/core/library/lessons/map";
import { prisma } from "@zoonk/db";
import { lessonIconFixture, playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("links the same library row in two lessons that draw the same new name at once", async () => {
    const [cloud, nucleus] = [uniqueName(), uniqueName()];
    taggedAs({ cloud, nucleus });
    const [first, second] = await Promise.all([markedLesson(), markedLesson()]);

    await Promise.all([
      lessonMarksWorkflow({ lessonId: first.id }),
      lessonMarksWorkflow({ lessonId: second.id }),
    ]);

    const icon = await prisma.lessonIcon.findUniqueOrThrow({ where: { name: cloud } });

    await expect(linkedIcons(first.id)).resolves.toMatchObject({
      steps: [{ iconId: icon.id }, { iconId: icon.id }],
    });

    await expect(linkedIcons(second.id)).resolves.toMatchObject({
      steps: [{ iconId: icon.id }, { iconId: icon.id }],
    });
  });

  it("skips a name an earlier lesson failed to draw, without paying for it again", async () => {
    const [cloud, nucleus] = [uniqueName(), uniqueName()];
    taggedAs({ cloud, nucleus });
    const lesson = await markedLesson();

    await lessonIconFixture({ name: cloud, smallUrl: null, status: "failed", url: null });

    await expect(lessonMarksWorkflow({ lessonId: lesson.id })).resolves.toStrictEqual({
      drawn: 1,
      failed: 0,
      icons: 1,
    });

    expect(
      vi.mocked(generateLessonIconImage).mock.calls.map(([input]) => input.need.name),
    ).toStrictEqual([nucleus]);

    await expect(linkedIcons(lesson.id)).resolves.toMatchObject({
      steps: [
        { iconId: null, iconPending: false },
        { iconId: null, iconPending: false },
      ],
    });
  });
});
