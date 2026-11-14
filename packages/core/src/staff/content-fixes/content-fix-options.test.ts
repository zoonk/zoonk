import { prisma } from "@zoonk/db";
import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { challengeCaseFixture } from "@zoonk/testing/fixtures/challenge-contents";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import {
  libraryStepFixture,
  mediaAssetFixture,
  stepVariantFixture,
} from "@zoonk/testing/fixtures/library-steps";
import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { describe, expect, it } from "vitest";
import { excuseFixedAnswer } from "../../lesson-player/_utils/fixed-screens";
import { restoreRunAnswers } from "../../lesson-player/_utils/restore-run-answers";
import { type PlayableLibraryLesson } from "../../lesson-player/playable-lesson";
import {
  approve,
  proposeFix,
  publishedLesson,
  question,
  revertFix,
  signInApprover,
  signInProposer,
} from "./_test-utils/content-fix-steps";
import { findRowsFixedSince } from "./fixed-since";
import { proposeContentFix } from "./propose-content-fix";

const changed = {
  ...question,
  options: [
    question.options[0],
    { isCorrect: false, reason: "That's three and three.", text: "6" },
  ],
};

const change = (id: string, content: object, model = "Step") => ({
  id,
  model,
  setOptions: { content },
});

describe("screen option collections", () => {
  it("mints a stable id, removes an option, detects the in-flight fix and reverts", async () => {
    const { check, lesson } = await publishedLesson();
    await signInProposer();

    const fix = await proposeFix({
      changes: [change(check.id, changed)],
      reason: "Wrong distractor.",
    });

    const { key } = await signInApprover();

    await expect(approve({ fixId: fix.id, key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });

    const row = await prisma.step.findUniqueOrThrow({ where: { id: check.id } });

    expect(row.content).toMatchObject({
      options: [question.options[0], { id: expect.any(String), text: "6" }],
    });

    expect(row.content).not.toStrictEqual(question);

    const lessonView = {
      language: "en",
      steps: [{ content: row.content, id: check.id, kind: "check" }],
      targetLanguage: null,
    } as Pick<PlayableLibraryLesson, "language" | "steps" | "targetLanguage">;

    await expect(
      restoreRunAnswers({
        attempts: [
          {
            answer: { kind: "check", optionId: "b" },
            answeredAt: new Date(),
            isCorrect: false,
            score: null,
            stepId: check.id,
          },
        ],
        lesson: lessonView,
        userId: fix.id,
      }),
    ).resolves.toMatchObject([{ isCorrect: false, result: { checked: true, isCorrect: false } }]);

    await expect(
      findRowsFixedSince({ rows: [{ id: check.id, model: "Step" }], startedAt: new Date() }),
    ).resolves.toHaveLength(1);

    const updatedLesson = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });
    expect(updatedLesson.updatedAt.getTime()).toBeGreaterThanOrEqual(lesson.updatedAt.getTime());

    await expect(
      excuseFixedAnswer({
        run: { startedAt: new Date() },
        screen: { id: check.id, lessonId: lesson.id, sentenceId: null, wordId: null },
        verdict: null,
      }),
    ).resolves.toMatchObject({ checked: false });

    await signInProposer();
    const inverse = await revertFix({ fixId: fix.id, reason: "Restore original options." });
    expect(inverse.status).toBe("proposed");

    if (inverse.status !== "proposed") {
      throw new Error("Expected revert");
    }

    const approver = await signInApprover();

    await expect(approve({ fixId: inverse.fix.id, key: approver.key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });

    const restored = await prisma.step.findUniqueOrThrow({ where: { id: check.id } });
    expect(restored.content).toStrictEqual(question);
  });

  it("requires all variants and permits flipping flags without changing retained text", async () => {
    const { check } = await publishedLesson();
    const variant = await stepVariantFixture({ content: question, stepId: check.id });

    const content = {
      ...question,
      options: question.options.map((option) => ({ ...option, isCorrect: !option.isCorrect })),
    };

    await signInProposer();

    await expect(
      proposeContentFix({ changes: [change(check.id, content)], reason: "Wrong key." }),
    ).resolves.toMatchObject({ message: expect.stringContaining(variant.id), status: "invalid" });

    const fix = await proposeFix({
      changes: [change(check.id, content), change(variant.id, content, "StepVariant")],
      reason: "Wrong key.",
    });

    const { key } = await signInApprover();

    await expect(approve({ fixId: fix.id, key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });
  });

  it.each([
    { ...question, question: "A different question" },
    { ...question, options: question.options.map((option) => ({ ...option, text: "changed" })) },
    {
      ...question,
      options: [...question.options, { id: "reuse", isCorrect: false, reason: "No", text: "8" }],
    },
    { ...question, options: [question.options[0], question.options[0]] },
    { ...question, options: question.options.map((option) => ({ ...option, isCorrect: false })) },
  ])("refuses invalid collections or unrelated edits", async (content) => {
    const { check } = await publishedLesson();
    await signInProposer();

    await expect(
      proposeContentFix({ changes: [change(check.id, content)], reason: "Invalid edit." }),
    ).resolves.toMatchObject({ status: "invalid" });
  });

  it("marks approval stale when the options changed after proposal", async () => {
    const { check } = await publishedLesson();
    await signInProposer();

    const fix = await proposeFix({
      changes: [change(check.id, changed)],
      reason: "Wrong distractor.",
    });

    await prisma.step.update({
      data: { content: { ...question, question: "Updated elsewhere" } },
      where: { id: check.id },
    });

    const { key } = await signInApprover();

    await expect(approve({ fixId: fix.id, key })).resolves.toMatchObject({
      fix: { status: "stale" },
    });
  });
});

describe("option pictures", () => {
  it("unlinks a removed option picture, restores it on revert and refuses additions", async () => {
    const { check } = await publishedLesson();

    const content = {
      ...question,
      options: [
        ...question.options,
        { id: "c", isCorrect: false, reason: "That is too many.", text: "7" },
      ].map((option) => ({
        ...option,
        picture: { alt: "Dots in a line", prompt: "Dots in a line" },
      })),
    };

    await prisma.step.update({ data: { content }, where: { id: check.id } });
    const asset = await mediaAssetFixture();

    await prisma.stepOptionPicture.create({
      data: { mediaAssetId: asset.id, optionId: "c", stepId: check.id },
    });

    await signInProposer();

    const added = {
      ...content,
      options: [
        ...content.options,
        {
          isCorrect: false,
          picture: { alt: "Dots", prompt: "Dots" },
          reason: "Too many",
          text: "8",
        },
      ],
    };

    await expect(
      proposeContentFix({ changes: [change(check.id, added)], reason: "Add pictured option." }),
    ).resolves.toMatchObject({ message: expect.stringContaining("picture"), status: "invalid" });

    const fix = await proposeFix({
      changes: [change(check.id, { ...content, options: content.options.slice(0, 2) })],
      reason: "Remove distractor.",
    });

    expect(fix.effects).toContainEqual({
      count: 1,
      kind: "optionPicturesUnlinked",
      stepId: check.id,
    });

    const { key } = await signInApprover();

    await expect(approve({ fixId: fix.id, key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });

    await expect(prisma.stepOptionPicture.count({ where: { stepId: check.id } })).resolves.toBe(0);
    await signInProposer();
    const inverse = await revertFix({ fixId: fix.id, reason: "Restore pictured distractor." });

    if (inverse.status !== "proposed") {
      throw new Error(JSON.stringify(inverse));
    }

    const approver = await signInApprover();

    await expect(approve({ fixId: inverse.fix.id, key: approver.key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });

    await expect(
      prisma.stepOptionPicture.findMany({ where: { stepId: check.id } }),
    ).resolves.toMatchObject([{ mediaAssetId: asset.id, optionId: "c" }]);
  });
});

const challenge = challengeCaseFixture();
const activity = activityContentFixtures.areaModel;
const hook = playableStepContent.hook;
const exercise = playableStepContent.multipleChoice;
const firstNode = challenge.nodes[0];
const firstChoice = firstNode?.choices[0];

if (!firstNode || !firstChoice) {
  throw new Error("Expected challenge choices");
}

const { id: _choiceId, ...newChoice } = firstChoice;

describe("setOptions kind coverage", () => {
  it.each([
    { after: { ...hook, options: hook.options.slice(1) }, before: hook, kind: "hook" as const },
    {
      after: {
        ...exercise,
        options: [
          ...exercise.options,
          { feedback: "Try again.", isCorrect: false, text: "A ring" },
        ],
      },
      before: exercise,
      kind: "multipleChoice" as const,
    },
    {
      after: {
        ...activity,
        check: { ...activity.check, options: activity.check.options.slice(1) },
      },
      before: activity,
      kind: "activity" as const,
    },
    {
      after: {
        ...challenge,
        nodes: challenge.nodes.map((node, index) =>
          index === 0
            ? {
                ...node,
                choices: [
                  ...node.choices,
                  { ...newChoice, text: "Another way to make the same decision" },
                ],
              }
            : node,
        ),
      },
      before: challenge,
      kind: "challenge" as const,
    },
  ])("applies $kind collections with the kind's validators", async ({ after, before, kind }) => {
    const lesson = await libraryLessonFixture({ contentStatus: "completed" });

    const step = await libraryStepFixture({
      content: before,
      kind,
      lessonId: lesson.id,
      position: 0,
    });

    await signInProposer();

    const fix = await proposeFix({
      changes: [change(step.id, after)],
      reason: "Correct the option collection.",
    });

    const { key } = await signInApprover();

    await expect(approve({ fixId: fix.id, key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });
  });
});
