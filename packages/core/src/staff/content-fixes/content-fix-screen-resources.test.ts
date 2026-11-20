import { prisma } from "@zoonk/db";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { languageLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { describe, expect, it } from "vitest";
import {
  approve,
  intro,
  proposeFix,
  publishedLesson,
  signInApprover,
  signInProposer,
} from "./_test-utils/content-fix-steps";
import { contentFixProposalSchema } from "./contract";
import { proposeContentFix } from "./propose-content-fix";

describe("resources reviewed with a screen list", () => {
  it("saves a declared sentence with its recording and reviewed orders, and refuses a clip changed after review", async () => {
    const { lesson, steps, sentence } = await languageLessonFixture();

    const target = await prisma.sentence.create({
      data: {
        audioUrl: "https://audio.test/later.mp3",
        organizationId: sentence.organizationId,
        sentence: "I'll call you later.",
        targetLanguage: "en",
      },
    });

    const setScreens = {
      screens: [...steps.map(({ id }) => ({ id })), { kind: "reading", sentence: "later" }],
      sentences: [
        { id: sentence.id },
        {
          distractors: ["early"],
          explanation: "Later indica quando.",
          key: "later",
          otherSentenceOrders: ["Later I'll call you."],
          otherTranslationOrders: [],
          sentence: target.sentence,
          translation: "Ligo mais tarde.",
          translationDistractors: ["cedo"],
        },
      ],
      version: 1,
    };

    const input = {
      changes: [{ id: lesson.id, model: "Lesson", setScreens }],
      reason: "Add the missing reading.",
    };

    await signInProposer();
    const stale = await proposeFix(input);

    await prisma.sentence.update({
      data: { audioUrl: "https://audio.test/corrected.mp3" },
      where: { id: target.id },
    });

    const approver = await signInApprover();

    await expect(approve({ fixId: stale.id, key: approver.key })).resolves.toMatchObject({
      fix: { status: "stale" },
    });

    await signInProposer();
    const reviewed = await proposeFix(input);
    const { key } = await signInApprover();

    await expect(approve({ fixId: reviewed.id, key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });

    const row = await prisma.lessonSentence.findUniqueOrThrow({
      where: { lessonId_sentenceId: { lessonId: lesson.id, sentenceId: target.id } },
    });

    expect(row).toMatchObject({
      ordersOwedAt: null,
      otherSentenceOrders: ["Later I'll call you."],
      otherTranslationOrders: [],
    });
  });

  it("requires a checked picture, names every missing clip, and links the reviewed asset", async () => {
    const { lesson, reading } = await publishedLesson();
    const asset = await mediaAssetFixture({ checkOwedAt: new Date() });

    const screen = {
      content: { ...intro, image: { alt: "Two apples", prompt: "Two apples on a plate" } },
      kind: "explanation",
      mediaAssetId: asset.id,
    };

    const change = {
      id: lesson.id,
      model: "Lesson",
      setScreens: { screens: [{ id: reading.id }, screen], version: 1 },
    };

    await signInProposer();

    const invalid = await proposeContentFix({
      changes: [
        {
          ...change,
          setScreens: {
            ...change.setScreens,
            words: [{ distractors: [], key: "new", translation: "maçã", word: "apple" }],
          },
        },
      ],
      reason: "Missing fruit.",
    });

    expect(invalid).toMatchObject({
      message: expect.stringContaining("screens[1].mediaAssetId"),
      status: "invalid",
    });

    expect(invalid).toMatchObject({ message: expect.stringContaining("words[0].word") });
    await prisma.mediaAsset.update({ data: { checkOwedAt: null }, where: { id: asset.id } });
    const fix = await proposeFix({ changes: [change], reason: "Show the count." });
    const { key } = await signInApprover();

    await expect(approve({ fixId: fix.id, key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });

    await expect(
      prisma.step.count({ where: { lessonId: lesson.id, mediaAssetId: asset.id, version: 2 } }),
    ).resolves.toBe(1);
  });

  it("counts declarations and generated pictures against the ten review units", () => {
    const id = crypto.randomUUID();
    const words = Array.from({ length: 8 }, (_, index) => ({ key: String(index) }));

    const parse = (screens: object[]) =>
      contentFixProposalSchema.safeParse({
        changes: [{ id, model: "Lesson", setScreens: { screens, words } }],
        reason: "Review the lesson words.",
      }).success;

    expect(parse([{ id }, { id }, { picture: {} }])).toBe(true);
    expect(parse([{ picture: {} }, { picture: {} }])).toBe(false);
  });
});
