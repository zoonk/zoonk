import { randomUUID } from "node:crypto";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { expect, test } from "./fixtures";
import { setDeviceMode } from "./learn-personas";

/**
 * A private course's pictures live in the private Blob store, so the player loads them from main's
 * own file route with the learner's session cookie, never through the shared image optimizer.
 * Blob storage is an external service E2E servers never call, so the file route's answer for the
 * owner is stood in for; who may read a file is checked on the real route below.
 */

/** The smallest valid PNG, one transparent pixel, for the stood-in file route. */
const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

const PICTURE_ALT = "A fuzzy cloud around a nucleus";

test.describe("A private course's pictures", () => {
  test("the player shows the owner their picture from their own file route", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const pathname = `images/${noProgressUser.id}/step-${randomUUID()}.webp`;

    const picture = await mediaAssetFixture({
      ownerId: noProgressUser.id,
      url: `https://store.private.blob.vercel-storage.com/${pathname}`,
      visibility: "private",
    });

    const { lesson } = await playableLessonFixture({
      lesson: { ownerId: noProgressUser.id, visibility: "private" },
      steps: [
        {
          content: {
            ...playableStepContent.explanation,
            image: { alt: PICTURE_ALT, prompt: "Electron cloud" },
          },
          kind: "explanation",
          mediaAssetId: picture.id,
        },
      ],
    });

    const requestedFiles: string[] = [];

    await page.route("**/api/files/**", async (route) => {
      requestedFiles.push(new URL(route.request().url()).pathname);
      await route.fulfill({ body: PIXEL_PNG, contentType: "image/png" });
    });

    await setDeviceMode(page.context(), "fun");
    await page.goto(`/learn/${lesson.id}`);

    await expect(page.getByRole("img", { name: PICTURE_ALT })).toBeVisible();
    expect(requestedFiles).toContain(`/api/files/${pathname}`);
  });
});

test.describe("Private file route", () => {
  test("asks a visitor to sign in and doesn't show one learner another's file", async ({
    page,
    userWithoutProgress,
  }) => {
    const path = `/api/files/images/${randomUUID()}/step.webp`;

    const [visitorResponse, otherResponse] = await Promise.all([
      page.request.get(path),
      userWithoutProgress.request.get(path),
    ]);

    expect(visitorResponse.status()).toBe(401);
    expect(otherResponse.status()).toBe(404);
  });
});
