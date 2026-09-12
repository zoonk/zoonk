import { type Page } from "./fixtures";

/**
 * Holds client scripts so tests can exercise controls while only their HTML is available.
 * After assertions, unroute with ignoreErrors: removing interception can continue in-flight
 * requests before their handlers fulfill them, even when unrouteAll uses wait.
 */
export async function holdHydration({
  page,
  scriptText,
}: {
  page: Page;
  scriptText?: string;
}): Promise<() => void> {
  const scripts = Promise.withResolvers<null>();

  await page.route("**/_next/static/chunks/**", async (route) => {
    const response = await route.fetch();
    const script = await response.text();

    if (!scriptText || script.includes(scriptText)) {
      await scripts.promise;
    }

    await route.fulfill({ response });
  });

  return () => scripts.resolve(null);
}
