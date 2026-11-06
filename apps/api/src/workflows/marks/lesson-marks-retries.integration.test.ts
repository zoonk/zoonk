import { randomUUID } from "node:crypto";
import { generateLessonIconImage } from "@zoonk/ai/tasks/icons/image";
import { tagLesson } from "@zoonk/ai/tasks/lesson-marks";
import { uploadImage } from "@zoonk/core/images/upload";
import { prisma } from "@zoonk/db";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { drawnIcon } from "./_test-utils/icon-results";
import { lessonMarksWorkflow } from "./lesson-marks-workflow";

vi.mock("@zoonk/ai/tasks/lesson-marks", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  tagLesson: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/icons/image", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateLessonIconImage: vi.fn(),
}));

vi.mock("@zoonk/core/images/upload", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  uploadImage: vi.fn(),
}));

function randomWord() {
  return `zq${randomUUID().replaceAll(/[\d-]/gu, "").slice(0, 8)}`;
}

function need(name: string) {
  return { description: `A drawing of a ${name}`, name, searchWords: [] };
}

describe("lesson marks durability", () => {
  it("retries only the drawing whose upload failed, never tagging the lesson, claiming its name or drawing the other icon again", async () => {
    const [first, second] = [`${randomWord()} ${randomWord()}`, `${randomWord()} ${randomWord()}`];

    vi.mocked(tagLesson).mockResolvedValue({
      data: {
        ideas: [{ about: "What the electron does", icon: need(second) }],
        screens: [{ example: null, icon: need(first), ideaIndex: 0, underline: null }],
      },
    } as never);

    vi.mocked(generateLessonIconImage).mockResolvedValue(drawnIcon as never);
    let failedOnce = false;

    vi.mocked(uploadImage).mockImplementation(async ({ fileName }) => {
      if (fileName.includes(second.replaceAll(" ", "-")) && !failedOnce) {
        failedOnce = true;
        return { data: null, error: new Error("Blob store unavailable") };
      }

      return { data: `https://blob.test/${randomUUID()}/${fileName}`, error: null };
    });

    const { lesson } = await playableLessonFixture({
      lesson: { summary: { ideas: [{ text: "The electron spreads as a cloud." }], shape: "hub" } },
      steps: ["explanation"],
    });

    const run = await start(lessonMarksWorkflow, [{ lessonId: lesson.id }]);

    await expect(run.returnValue).resolves.toStrictEqual({ drawn: 2, failed: 0, icons: 2 });

    expect(tagLesson).toHaveBeenCalledOnce();

    expect(
      vi
        .mocked(generateLessonIconImage)
        .mock.calls.map(([input]) => input.need.name)
        .toSorted(),
    ).toStrictEqual([first, second, second].toSorted());

    const [step, icons] = await Promise.all([
      prisma.step.findFirstOrThrow({ select: { marks: true }, where: { lessonId: lesson.id } }),
      prisma.lessonIcon.findMany({ where: { name: { in: [first, second] } } }),
    ]);

    expect(icons.map((icon) => icon.status)).toStrictEqual(["completed", "completed"]);

    expect(step.marks).toMatchObject({
      iconId: icons.find((icon) => icon.name === first)?.id,
      iconPending: false,
    });
  });
});
