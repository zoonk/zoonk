import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { expect, test } from "@zoonk/e2e/fixtures";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { createBearerLearner } from "./helpers/bearer";

/**
 * A private course's pictures live in the private Blob store, which only the server can read, so
 * the API points them at `GET /v1/files/...` and serves them to their owner alone. Reading the
 * owner's file reaches Blob storage, an external service E2E servers never call; core's tests
 * cover it with the store standing in.
 */
test.describe("Private files API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test("points a private lesson's picture at the file route, which only its owner may read", async () => {
    const [owner, other, visitor] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "private-file-owner" }),
      createBearerLearner({ baseURL, prefix: "private-file-other" }),
      request.newContext({ baseURL }),
    ]);

    const filePath = `images/${owner.userId}/step-${randomUUID()}.webp`;

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

    const [otherResponse, visitorResponse] = await Promise.all([
      other.api.get(`/v1/files/${filePath}`),
      visitor.get(`/v1/files/${filePath}`),
    ]);

    expect(otherResponse.status()).toBe(404);
    expect(visitorResponse.status()).toBe(401);

    await Promise.all([owner.api.dispose(), other.api.dispose(), visitor.dispose()]);
  });

  test("only knows the private store's folders", async () => {
    const learner = await createBearerLearner({ baseURL, prefix: "private-file-folder" });

    const response = await learner.api.get(`/v1/files/library/${learner.userId}/step.webp`);

    expect(response.status()).toBe(400);

    await learner.api.dispose();
  });
});
