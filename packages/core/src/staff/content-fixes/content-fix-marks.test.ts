import { tagLesson } from "@zoonk/ai/tasks/lesson-marks";
import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { describe, expect, it, vi } from "vitest";
import { CURRENT_STEPS } from "../../library/lessons/lesson-versions";
import {
  approve,
  proposeFix,
  question,
  signInApprover,
  signInProposer,
} from "./_test-utils/content-fix-steps";
import {
  failFixMedia,
  listPendingFixMedia,
  produceFixMarks,
  recordFixMedia,
} from "./prepare-content-fix-media";
import { proposeContentFix } from "./propose-content-fix";

const reason = "Show the program as a code block";
const before = "Adding joins numbers. `2 + 2` gives 4.";
const after = "Adding joins numbers. Run this:\n\n```\n2 + 2\n```\n\nIt gives 4.";
const example = "Run this:\n\n```\n2 + 2\n```\n\nIt gives 4.";

const savedMarks = {
  example: "`2 + 2` gives 4.",
  iconId: null,
  iconPending: false,
  ideaIndex: 0,
  underline: "joins numbers",
};

/** A tagged lesson whose explanation boxes an example and underlines its main point. */
async function markedLesson() {
  const lesson = await libraryLessonFixture({
    contentStatus: "completed",
    summary: { ideas: [{ text: "Adding numbers." }] },
  });

  const [reading, check] = await Promise.all([
    libraryStepFixture({
      content: { text: before, title: "Adding" },
      lessonId: lesson.id,
      marks: savedMarks,
      position: 0,
    }),
    libraryStepFixture({
      content: { ...question, basis: { position: 0, quote: "Adding joins numbers." } },
      kind: "check",
      lessonId: lesson.id,
      position: 1,
    }),
  ]);

  return { check, lesson, reading };
}

function markedAs(quotes: { example: string | null; underline: string | null }) {
  vi.mocked(tagLesson).mockImplementationOnce(async ({ screens }) => ({
    data: { ideas: [], screens: screens.map(() => ({ ...quotes, icon: null, ideaIndex: null })) },
    output: {} as never,
    provenance: {} as never,
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  }));
}

async function prepareMarks(fixId: string) {
  const [need] = await listPendingFixMedia(fixId);

  if (need?.kind !== "marks") {
    throw new Error("Expected the fix to owe marks");
  }

  await recordFixMedia({ fixId, key: need.key, result: await produceFixMarks(need) });
  return need;
}

async function approveFix(fixId: string) {
  const { key } = await signInApprover();
  await expect(approve({ fixId, key })).resolves.toMatchObject({ fix: { status: "applied" } });
}

function explanationMarks(lessonId: string) {
  return prisma.step.findFirstOrThrow({
    select: { marks: true },
    where: { kind: "explanation", lessonId, ...CURRENT_STEPS },
  });
}

describe("marks on screens a fix rewrites", () => {
  it("marks the example a rewritten explanation lost before review, keeping its idea and the underline that still fits", async () => {
    const { check, lesson, reading } = await markedLesson();
    await signInProposer();

    const fix = await proposeFix({
      changes: [
        {
          id: lesson.id,
          model: "Lesson",
          setScreens: {
            screens: [
              { content: { text: after, title: "Adding" }, id: reading.id },
              { id: check.id },
            ],
            version: 1,
          },
        },
      ],
      reason,
    });

    markedAs({ example, underline: "a different phrase" });
    const need = await prepareMarks(fix.id);

    expect(need).toMatchObject({
      kept: [{ example: null, underline: "joins numbers" }],
      lessonTitle: lesson.title,
      screens: [{ kind: "explanation", text: after }],
    });

    await approveFix(fix.id);

    await expect(explanationMarks(lesson.id)).resolves.toStrictEqual({
      marks: { ...savedMarks, example, iconNeed: null },
    });
  });

  it("marks a kept screen again when asked, and refuses the ask on a screen without marked text", async () => {
    const { check, lesson, reading } = await markedLesson();

    await prisma.step.update({
      data: { marks: { ...savedMarks, example: null } },
      where: { id: reading.id },
    });

    await signInProposer();

    const setScreens = (screens: object[]) => [
      { id: lesson.id, model: "Lesson", setScreens: { screens, version: 1 } },
    ];

    await expect(
      proposeContentFix({
        changes: setScreens([{ id: reading.id }, { id: check.id, remark: true }]),
        reason,
      }),
    ).resolves.toMatchObject({
      message: expect.stringContaining("screens[1].remark"),
      status: "invalid",
    });

    const fix = await proposeFix({
      changes: setScreens([{ id: reading.id, remark: true }, { id: check.id }]),
      reason: "Put back the example box an earlier fix dropped",
    });

    markedAs({ example: "`2 + 2` gives 4.", underline: null });
    await prepareMarks(fix.id);
    await approveFix(fix.id);

    await expect(explanationMarks(lesson.id)).resolves.toStrictEqual({ marks: savedMarks });
  });

  it("keeps the quotes that still fit when marking fails", async () => {
    const { check, lesson, reading } = await markedLesson();
    await signInProposer();

    const fix = await proposeFix({
      changes: [
        {
          id: lesson.id,
          model: "Lesson",
          setScreens: {
            screens: [
              { content: { text: after, title: "Adding" }, id: reading.id },
              { id: check.id },
            ],
            version: 1,
          },
        },
      ],
      reason,
    });

    const [need] = await listPendingFixMedia(fix.id);

    if (!need) {
      throw new Error("Expected the fix to owe marks");
    }

    await failFixMedia({ fixId: fix.id, need });
    await approveFix(fix.id);

    await expect(explanationMarks(lesson.id)).resolves.toStrictEqual({
      marks: { ...savedMarks, example: null, iconNeed: null },
    });
  });

  it("marks a screen a Step fix rewrites, and leaves a screen whose quotes still fit alone", async () => {
    const { lesson, reading } = await markedLesson();
    await signInProposer();

    const kept = await proposeFix({
      changes: [
        {
          id: reading.id,
          model: "Step",
          set: { content: { text: `${before} Order doesn't matter.`, title: "Adding" } },
        },
      ],
      reason: "Add that order doesn't matter",
    });

    await expect(listPendingFixMedia(kept.id)).resolves.toStrictEqual([]);

    await prisma.contentFix.update({ data: { status: "withdrawn" }, where: { id: kept.id } });

    const fix = await proposeFix({
      changes: [
        { id: reading.id, model: "Step", set: { content: { text: after, title: "Adding" } } },
      ],
      reason,
    });

    markedAs({ example, underline: null });
    const need = await prepareMarks(fix.id);
    expect(need.key).toBe(`marks:${reading.id}`);
    await approveFix(fix.id);

    await expect(explanationMarks(lesson.id)).resolves.toStrictEqual({
      marks: { ...savedMarks, example },
    });
  });
});
