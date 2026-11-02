import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { expect, test } from "@zoonk/e2e/fixtures";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { createBearerLearner } from "./helpers/bearer";

/** Reading the owner's file reaches Blob storage, which E2E servers never call; core's tests cover it. */
test("points a private lesson's picture at the file route, which serves the private store's files to their owner alone", async () => {
  const baseURL = process.env.E2E_BASE_URL ?? "";

  const [owner, other, visitor] = await Promise.all([
    createBearerLearner({ baseURL, prefix: "private-file-owner" }),
    createBearerLearner({ baseURL, prefix: "private-file-other" }),
    request.newContext({ baseURL }),
  ]);

  const filePath = `images/${owner.userId}/step-${randomUUID()}.webp`;
  const clipPath = `audio/${owner.userId}/it-${randomUUID()}.mp3`;

  const picture = await mediaAssetFixture({
    ownerId: owner.userId,
    url: `https://store.private.blob.vercel-storage.com/${filePath}`,
    visibility: "private",
  });

  const { lesson } = await playableLessonFixture({
    lesson: { ownerId: owner.userId, visibility: "private" },
    steps: [
      {
        content: {
          ...playableStepContent.explanation,
          image: { alt: "An electron cloud", prompt: "Electron cloud" },
        },
        kind: "explanation",
        mediaAssetId: picture.id,
      },
    ],
  });

  const lessonResponse = await owner.api.get(`/v1/library/lessons/${lesson.id}`);

  expect(lessonResponse.status()).toBe(200);

  const { lesson: playable } = await lessonResponse.json();

  expect(new URL(playable.steps[0].image.url).pathname).toBe(`/v1/files/${filePath}`);

  const responses = await Promise.all([
    other.api.get(`/v1/files/${filePath}`),
    visitor.get(`/v1/files/${filePath}`),
    other.api.get(`/v1/files/${clipPath}`),
    visitor.get(`/v1/files/${clipPath}`),
    owner.api.get(`/v1/files/library/${owner.userId}/step.webp`),
  ]);

  expect(responses.map((response) => response.status())).toStrictEqual([404, 401, 404, 401, 400]);

  await Promise.all([owner.api.dispose(), other.api.dispose(), visitor.dispose()]);
});
