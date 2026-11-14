import { type Page, type Request } from "@playwright/test";

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
    /**
     * Hands the answer over and says whether it then took the learner to `away`. A navigation counts
     * from its request, since on a loaded machine its page can take longer than the wait to show.
     */
    release: async (away: RegExp): Promise<boolean> => {
      const leadsAway = (request: Request) => {
        const { origin, pathname } = new URL(request.url());

        return (
          !request.headers()["next-router-prefetch"] &&
          (away.test(request.url()) || away.test(`${origin}${pathname}`))
        );
      };

      const followed = Promise.race([
        page.waitForURL(away, { timeout: FOLLOW_MS }),
        page.waitForRequest(leadsAway, { timeout: FOLLOW_MS }),
      ]).then(
        () => true,
        () => false,
      );

      released.resolve(null);
      await delivered.promise;
      return followed;
    },
  };
}
