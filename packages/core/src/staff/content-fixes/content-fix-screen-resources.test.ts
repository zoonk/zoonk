import { prisma } from "@zoonk/db";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { languageLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { describe, expect, it, vi } from "vitest";
import { serveStoredFile, storeBlobUploads } from "../../_test-utils/blob-uploads";
import { CURRENT_STEPS } from "../../library/lessons/lesson-versions";
import {
  drawTestImage,
  mockDrawnImages,
  mockImageChecks,
  mockImageScene,
  testScene,
} from "../../library/media/_test-utils/image-mocks";
import {
  approve,
  intro,
  proposeFix,
  publishedLesson,
  question,
  revertInAdmin,
  signInApprover,
  signInProposer,
} from "./_test-utils/content-fix-steps";
import { mockVoice } from "./_test-utils/mock-fix-voice";
import {
  checkFixPicture,
  drawFixPicture,
  listPendingFixMedia,
  planFixPicture,
  recordFixClip,
  recordFixMedia,
  storeFixPicture,
} from "./prepare-content-fix-media";
import { proposeContentFix } from "./propose-content-fix";

describe("resources reviewed with a screen list", () => {
  it("adds a picture to a kept screen and remaps the question that quotes it", async () => {
    const { lesson, reading, check } = await publishedLesson();
    const picture = { alt: "Two apples", prompt: "Two apples on a plate" };

    await signInProposer();

    const fix = await proposeFix({
      changes: [
        {
          id: lesson.id,
          model: "Lesson",
          setScreens: {
            screens: [
              { content: intro, kind: "explanation" },
              { id: reading.id, picture },
              { id: check.id },
            ],
            version: 1,
          },
        },
      ],
      reason: "Illustrate the explanation.",
    });

    const [need] = await listPendingFixMedia(fix.id);

    expect(need).toMatchObject({ kind: "picture", request: picture.prompt });

    if (!need) {
      throw new Error("Expected a pending picture");
    }

    const asset = await mediaAssetFixture({ checkOwedAt: null });

    await recordFixMedia({
      fixId: fix.id,
      key: need.key,
      result: { key: need.key, kind: "picture", mediaAssetId: asset.id, url: asset.url },
    });

    const { key } = await signInApprover();

    await expect(approve({ fixId: fix.id, key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });

    await expect(
      prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { lessonId: lesson.id, ...CURRENT_STEPS },
      }),
    ).resolves.toMatchObject([
      { content: intro },
      { content: { ...intro, image: picture }, mediaAssetId: asset.id, version: 2 },
      { content: { ...question, basis: { ...question.basis, position: 1 } } },
    ]);
  });

  it("refuses a proposal before storing work when its new icons and alphabet clips exceed ten units", async () => {
    const [{ lesson, steps }, proposer] = await Promise.all([
      languageLessonFixture(),
      signInProposer(),
    ]);

    const ideas = Array.from({ length: 9 }, (_, index) => ({
      label: `Greeting ${String(index + 1)}`,
      text: `Practice greeting number ${String(index + 1)}.`,
    }));

    const setScreens = {
      ideas,
      screens: [
        ...steps.map(({ id }) => ({ id })),
        {
          content: {
            audioText: "A",
            audioUrl: null,
            forms: [{ label: "uppercase", symbol: "A" }],
            pronunciation: "ay",
            readingAid: "Like the start of acorn.",
            symbol: "A",
          },
          kind: "alphabet",
        },
      ],
      version: 1,
    };

    const input = {
      changes: [{ id: lesson.id, model: "Lesson", setScreens }],
      reason: "Add greetings and a letter.",
    };

    const atLimit = {
      ...input,
      changes: [
        { id: lesson.id, model: "Lesson", setScreens: { ...setScreens, ideas: ideas.slice(1) } },
      ],
    };

    await expect(proposeContentFix(atLimit, { check: true })).resolves.toMatchObject({
      fixes: [
        {
          media: expect.arrayContaining([
            {
              key: expect.any(String),
              kind: "clip",
              language: "en",
              model: "AlphabetCard",
              text: "A",
            },
          ]),
        },
      ],
      status: "checked",
    });

    await expect(proposeContentFix(input, { check: true })).resolves.toMatchObject({
      message: expect.stringContaining("10 review units"),
      status: "invalid",
    });

    await expect(proposeContentFix(input)).resolves.toMatchObject({ status: "invalid" });
    await expect(prisma.contentFix.count({ where: { proposerId: proposer.id } })).resolves.toBe(0);
  });

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

  it("checks a new screen picture before approval and reuses it when restoring the screen", async () => {
    const { lesson, reading } = await publishedLesson();
    const picture = { alt: "Two apples", prompt: "Two apples on a plate" };

    const input = {
      changes: [
        {
          id: lesson.id,
          model: "Lesson",
          setScreens: {
            screens: [{ id: reading.id }, { content: intro, kind: "explanation", picture }],
            version: 1,
          },
        },
      ],
      reason: "Show two apples.",
    };

    await signInProposer();

    await expect(proposeContentFix(input, { check: true })).resolves.toMatchObject({
      fixes: [{ media: [{ kind: "picture", request: picture.prompt }] }],
      status: "checked",
    });

    const fix = await proposeFix(input);
    const [need] = await listPendingFixMedia(fix.id);

    if (need?.kind !== "picture") {
      throw new Error("Expected a pending picture");
    }

    const image = await drawTestImage();
    storeBlobUploads();
    const plan = mockImageScene(testScene({ focalObject: picture.prompt }));
    mockDrawnImages([image]);
    const check = mockImageChecks([true]);
    serveStoredFile({ data: image, mediaType: "image/webp" });

    try {
      const scene = await planFixPicture(need);
      const drawn = await drawFixPicture({ need, scene });
      await expect(checkFixPicture({ drawn, need, scene })).resolves.toBe(true);
      const result = await storeFixPicture({ drawn, fixId: fix.id, need, scene });
      await recordFixMedia({ fixId: fix.id, key: need.key, result });

      const { key } = await signInApprover();

      await expect(approve({ fixId: fix.id, key })).resolves.toMatchObject({
        fix: { status: "applied" },
      });

      const linked = () =>
        prisma.step.findFirst({
          where: { lessonId: lesson.id, mediaAssetId: result.mediaAssetId, ...CURRENT_STEPS },
        });

      await expect(linked()).resolves.toMatchObject({ content: { image: picture } });

      const inverse = await revertInAdmin({
        fixId: fix.id,
        reason: "Restore the original screens",
      });

      if (inverse.status !== "proposed") {
        throw new Error(JSON.stringify(inverse));
      }

      expect(inverse.fix.media).toStrictEqual([]);

      await expect(approve({ fixId: inverse.fix.id, key })).resolves.toMatchObject({
        fix: { status: "applied" },
      });

      await expect(linked()).resolves.toBeNull();

      const restore = await revertInAdmin({
        fixId: inverse.fix.id,
        reason: "Restore the illustration",
      });

      if (restore.status !== "proposed") {
        throw new Error(JSON.stringify(restore));
      }

      expect(restore.fix.media).toStrictEqual([]);

      await expect(approve({ fixId: restore.fix.id, key })).resolves.toMatchObject({
        fix: { status: "applied" },
      });

      await expect(linked()).resolves.toMatchObject({ content: { image: picture } });
      expect(plan).toHaveBeenCalledOnce();
      expect(check).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("records a new alphabet card and sentence in the lesson's target language", async () => {
    const { lesson, sentence, steps } = await languageLessonFixture();

    const content = {
      audioText: "A",
      audioUrl: null,
      forms: [{ label: "uppercase", symbol: "A" }],
      pronunciation: "ay",
      readingAid: "Like the start of acorn.",
      symbol: "A",
    };

    await signInProposer();

    const fix = await proposeFix({
      changes: [
        {
          id: lesson.id,
          model: "Lesson",
          setScreens: {
            screens: [
              ...steps.map(({ id }) => ({ id })),
              { content, kind: "alphabet" },
              { kind: "reading", sentence: "acorn" },
            ],
            sentences: [
              { id: sentence.id },
              {
                distractors: [],
                explanation: "Acorn means bolota.",
                key: "acorn",
                otherSentenceOrders: [],
                otherTranslationOrders: [],
                sentence: "I found an acorn.",
                translation: "Achei uma bolota.",
                translationDistractors: [],
              },
            ],
            version: 1,
          },
        },
      ],
      reason: "Add the alphabet card and the example sentence.",
    });

    const pending = await listPendingFixMedia(fix.id);
    expect(pending).toMatchObject([{ model: "Sentence" }, { model: "AlphabetCard" }]);
    mockVoice();

    await Promise.all(
      pending
        .filter((need) => need.kind === "clip")
        .map((need) => recordFixClip({ fixId: fix.id, need })),
    );

    const { key } = await signInApprover();

    await expect(approve({ fixId: fix.id, key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });

    await expect(
      prisma.step.findFirst({ where: { kind: "alphabet", lessonId: lesson.id, version: 2 } }),
    ).resolves.toMatchObject({
      content: { audioText: "A", audioUrl: expect.stringContaining("blob.test") },
    });

    await expect(
      prisma.lessonSentence.findFirst({
        include: { sentence: true },
        where: { lessonId: lesson.id, sentence: { sentence: "I found an acorn." } },
      }),
    ).resolves.toMatchObject({
      ordersOwedAt: null,
      sentence: { audioUrl: expect.stringContaining("blob.test") },
    });
  });

  it("counts vocabulary declarations and new media but leaves reused recordings free", async () => {
    const { lesson, steps, word } = await languageLessonFixture();

    const shared = await prisma.word.create({
      data: {
        audioUrl: "https://audio.test/apple.mp3",
        organizationId: word.organizationId,
        targetLanguage: word.targetLanguage,
        word: "apple",
      },
    });

    await signInProposer();

    const input = {
      changes: [
        {
          id: lesson.id,
          model: "Lesson",
          setScreens: {
            ideas: Array.from({ length: 7 }, (_, index) => ({
              label: `Fruit ${String(index + 1)}`,
              text: `Practice fruit word number ${String(index + 1)}.`,
            })),
            screens: [
              ...steps.map(({ id }) => ({ id })),
              { kind: "vocabulary", word: "new" },
              {
                content: intro,
                kind: "explanation",
                picture: { alt: "An apple", prompt: "An apple on a plate" },
              },
            ],
            version: 1,
            words: [
              { id: word.id },
              { distractors: [], key: "new", translation: "maçã", word: shared.word },
            ],
          },
        },
      ],
      reason: "Add a vocabulary word and a picture.",
    };

    const reused = await proposeContentFix(input, { check: true });
    expect(reused).toMatchObject({ fixes: [{ media: { length: 8 } }], status: "checked" });

    await prisma.word.update({ data: { audioUrl: null }, where: { id: shared.id } });

    await expect(proposeContentFix(input, { check: true })).resolves.toMatchObject({
      message: expect.stringContaining("10 review units"),
      status: "invalid",
    });
  });
});
