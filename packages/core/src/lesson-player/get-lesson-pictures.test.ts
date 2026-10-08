import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture, mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { getLessonPictures } from "./get-lesson-pictures";
import { getPlayableLibraryLesson } from "./get-playable-library-lesson";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

const picture = { alt: "Otávio stands next to a blue bike.", prompt: "Otávio next to a bike" };

const check = {
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
});
