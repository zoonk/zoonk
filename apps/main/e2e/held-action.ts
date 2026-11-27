import { type Page, type Request, type Route } from "@playwright/test";

/** A late answer that still moves the learner does so at once; this leaves room for a loaded machine. */
const FOLLOW_MS = 5000;

function leadsTo(away: RegExp) {
  return (request: Request) => {
    const { origin, pathname } = new URL(request.url());

    return (
      !request.headers()["next-router-prefetch"] &&
      (away.test(request.url()) || away.test(`${origin}${pathname}`))
    );
  };
}

/**
 * Holds the answer to the page's next Server Action on `path`, as a slow connection would: `start`
 * sends it, `whileHeld` runs once its request has reached the server, and then the answer is handed
 * over. Only that one request is held, and it is answered and its route removed before this
 * returns, even when a step fails, so nothing is left in flight when the test ends.
 *
 * With `away`, it says whether the answer then took the learner there. A navigation counts from its
 * request, since on a loaded machine its page can take longer than the wait to show.
 */
export async function holdActionAnswer(
  page: Page,
  path: string,
  {
    away,
    start,
    whileHeld,
  }: { away?: RegExp; start: () => Promise<unknown>; whileHeld: () => Promise<unknown> },
): Promise<boolean> {
  const pattern = `**${path}`;
  const held = Promise.withResolvers<Error | null>();
  const released = Promise.withResolvers<null>();
  const delivered = Promise.withResolvers<Error | null>();
  let caught = false;

  const handler = async (route: Route) => {
    if (
      caught ||
      route.request().method() !== "POST" ||
      !route.request().headers()["next-action"]
    ) {
      await route.fallback();
      return;
    }

    caught = true;

    try {
      await page.unroute(pattern, handler);
      const response = await route.fetch();
      held.resolve(null);
      await released.promise;
      await route.fulfill({ response });
      delivered.resolve(null);
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      held.resolve(failure);
      delivered.resolve(failure);
    }
  };

  await page.route(pattern, handler);

  try {
    await start();
    const unanswered = await held.promise;

    if (unanswered) {
      throw unanswered;
    }

    await whileHeld();

    const followed = away
      ? Promise.race([
          page.waitForURL(away, { timeout: FOLLOW_MS }),
          page.waitForRequest(leadsTo(away), { timeout: FOLLOW_MS }),
        ]).then(
          () => true,
          () => false,
        )
      : Promise.resolve(true);

    released.resolve(null);
    const failure = await delivered.promise;

    if (failure) {
      throw failure;
    }

    return await followed;
  } finally {
    released.resolve(null);

    if (caught) {
      await delivered.promise;
    }

    await page.unroute(pattern, handler);
  }
}
