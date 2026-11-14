import { type Page } from "@playwright/test";

/** A late answer that still moves the learner does so at once; this leaves room for a loaded machine. */
const FOLLOW_MS = 5000;

/** Holds the answer to the page's Server Action on `path`, as a slow connection would, until released. */
export async function holdActionAnswer(page: Page, path: string) {
  const held = Promise.withResolvers<null>();
  const released = Promise.withResolvers<null>();
  const delivered = Promise.withResolvers<null>();

  await page.route(`**${path}`, async (route) => {
    if (route.request().method() !== "POST" || !route.request().headers()["next-action"]) {
      await route.continue();
      return;
    }

    const response = await route.fetch();
    held.resolve(null);
    await released.promise;

    try {
      await route.fulfill({ response });
    } finally {
      delivered.resolve(null);
    }
  });

  return {
    held: held.promise,
    /** Hands the answer over and says whether it then took the learner to `away`. */
    release: async (away: RegExp): Promise<boolean> => {
      const followed = page.waitForURL(away, { timeout: FOLLOW_MS }).then(
        () => true,
        () => false,
      );

      released.resolve(null);
      await delivered.promise;
      return followed;
    },
  };
}
