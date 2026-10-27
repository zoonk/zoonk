import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture, mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import {
  numberedCheckContent,
  pictureCheckContent,
} from "@zoonk/testing/fixtures/playable-step-contents";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it } from "vitest";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { getLessonPictures } from "./get-lesson-pictures";
import { getPlayableLibraryLesson } from "./get-playable-library-lesson";

const picture = { alt: "Otávio stands next to a blue bike.", prompt: "Otávio next to a bike" };

const check = {
  basis: null,
  image: picture,
  options: [
    {
      id: "a",
      isCorrect: true,
      reason: "You see him standing.",
      text: "Otávio stands by the bike",
    },
    { id: "b", isCorrect: false, reason: "He isn't riding it.", text: "Otávio rides the bike" },
  ],
  question: "Which caption fits the picture?",
};

/** A lesson written moments ago whose question's picture the workflow hasn't drawn yet. */
async function lessonWithPendingPicture() {
  const { lesson, steps } = await playableLessonFixture({
    steps: [{ content: check, kind: "check" }],
  });

  return { lesson, step: steps[0] };
}

describe(getLessonPictures, () => {
  beforeEach(() => {
    mockSession(randomUUID());
  });

  it("marks a question's picture pending until it's drawn, then hands it over fresh", async () => {
    const { lesson, step } = await lessonWithPendingPicture();
    const played = await getPlayableLibraryLesson({ lessonId: lesson.id });

    expect(played?.status === "ready" && played.lesson.steps[0]).toMatchObject({
      image: null,
      imagePending: true,
    });

    await expect(getLessonPictures({ lessonId: lesson.id })).resolves.toStrictEqual([]);

    const asset = await mediaAssetFixture({ height: 1024, width: 1536 });
    await prisma.step.update({ data: { mediaAssetId: asset.id }, where: { id: step?.id } });

    await expect(getLessonPictures({ lessonId: lesson.id })).resolves.toStrictEqual([
      {
        image: { alt: picture.alt, height: 1024, id: asset.id, url: asset.url, width: 1536 },
        stepId: step?.id,
      },
    ]);
  });

  it("hands over only the screens still waiting, not every picture drawn so far", async () => {
    const { lesson, steps } = await playableLessonFixture({
      steps: [
        { content: check, kind: "check" },
        { content: check, kind: "check" },
      ],
    });

    const [shown, waiting] = steps;
    const [first, second] = await Promise.all([mediaAssetFixture({}), mediaAssetFixture({})]);

    await Promise.all([
      prisma.step.update({ data: { mediaAssetId: first.id }, where: { id: shown?.id } }),
      prisma.step.update({ data: { mediaAssetId: second.id }, where: { id: waiting?.id } }),
    ]);

    const pictures = await getLessonPictures({ lessonId: lesson.id, stepIds: [waiting!.id] });

    expect(pictures.map((drawn) => drawn.stepId)).toStrictEqual([waiting?.id]);
  });

  it("marks an explanation's picture pending too, since a screen asks only for pictures it needs", async () => {
    const { lesson } = await playableLessonFixture({
      steps: [
        {
          content: { image: picture, text: "The frontal lobe plans what you do.", title: "Lobes" },
          kind: "explanation",
        },
      ],
    });

    const played = await getPlayableLibraryLesson({ lessonId: lesson.id });

    expect(played?.status === "ready" && played.lesson.steps[0]).toMatchObject({
      image: null,
      imagePending: true,
    });
  });

  it("stops waiting for a picture of a screen written long ago", async () => {
    const { lesson, steps } = await playableLessonFixture({
      steps: [{ content: check, kind: "check" }],
    });

    await prisma.step.update({
      data: { generatedAt: new Date(Date.now() - 3_600_000) },
      where: { id: steps[0]?.id },
    });

    const played = await getPlayableLibraryLesson({ lessonId: lesson.id });

    expect(played?.status === "ready" && played.lesson.steps[0]).toMatchObject({
      image: null,
      imagePending: false,
    });
  });

  it("gives guests a public lesson's pictures, and a private lesson's only to its owner", async () => {
    const [owner, asset] = await Promise.all([userFixture(), mediaAssetFixture()]);

    const [publicLesson, privateLesson] = await Promise.all([
      libraryLessonFixture(),
      libraryLessonFixture({ ownerId: owner.id, visibility: "private" }),
    ]);

    await Promise.all(
      [publicLesson, privateLesson].map((lesson) =>
        libraryStepFixture({
          content: check,
          kind: "check",
          lessonId: lesson.id,
          mediaAssetId: asset.id,
        }),
      ),
    );

    mockGuestSession(randomUUID());
    await expect(getLessonPictures({ lessonId: publicLesson.id })).resolves.toHaveLength(1);
    await expect(getLessonPictures({ lessonId: privateLesson.id })).resolves.toStrictEqual([]);

    mockSession(owner.id);
    await expect(getLessonPictures({ lessonId: privateLesson.id })).resolves.toHaveLength(1);
    await expect(getLessonPictures({ lessonId: "not-a-lesson" })).resolves.toStrictEqual([]);
  });

  it("waits on a question's picture options, then hands each over keyed by its option", async () => {
    const { lesson, steps } = await playableLessonFixture({
      steps: [{ content: pictureCheckContent, kind: "check" }],
    });

    const played = await getPlayableLibraryLesson({ lessonId: lesson.id });

    expect(played?.status === "ready" && played.lesson.steps[0]).toMatchObject({
      image: null,
      imagePending: true,
    });

    const asset = await mediaAssetFixture();

    await prisma.stepOptionPicture.create({
      data: { mediaAssetId: asset.id, optionId: "gothic", stepId: steps[0]?.id ?? "" },
    });

    const [gothic] = pictureCheckContent.options;

    await expect(getLessonPictures({ lessonId: lesson.id })).resolves.toStrictEqual([
      {
        image: expect.objectContaining({ alt: gothic?.picture.alt, id: asset.id }),
        optionId: "gothic",
        stepId: steps[0]?.id,
      },
    ]);

    const replayed = await getPlayableLibraryLesson({ lessonId: lesson.id });

    // Two options still wait for theirs.
    expect(replayed?.status === "ready" && replayed.lesson.steps[0]).toMatchObject({
      imagePending: true,
      optionPictures: { gothic: expect.objectContaining({ id: asset.id }) },
    });
  });

  it("leaves out a question about a numbered picture that never came, and a diagram's key", async () => {
    const explore = {
      fields: activityContentFixtures.labeledDiagram.fields,
      template: "labeledDiagram",
    };

    const { lesson, steps } = await playableLessonFixture({
      steps: [
        { content: numberedCheckContent, kind: "check" },
        { content: { explore, text: "The heart has four chambers." }, kind: "explanation" },
        { content: activityContentFixtures.labeledDiagram, kind: "activity" },
      ],
    });

    // Moments after the lesson was written, every screen waits for its numbered picture.
    const fresh = await getPlayableLibraryLesson({ lessonId: lesson.id });
    expect(fresh?.status === "ready" && fresh.lesson.steps).toHaveLength(3);

    await prisma.step.updateMany({
      data: { generatedAt: new Date(Date.now() - 3_600_000) },
      where: { lessonId: lesson.id },
    });

    const played = await getPlayableLibraryLesson({ lessonId: lesson.id });
    const served = played?.status === "ready" ? played.lesson.steps : [];

    // Without the numbers nobody can tell which part is which: the questions are left out, and
    // the explanation teaches with its words alone.
    expect(served.map((step) => step.id)).toStrictEqual([steps[1]?.id]);
    expect(served[0]).toMatchObject({ content: { text: "The heart has four chambers." } });
    expect(served[0]?.kind === "explanation" && served[0].content.explore).toBeUndefined();
  });
});
