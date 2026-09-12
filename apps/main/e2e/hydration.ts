import { type Page } from "./fixtures";

/** Holds client scripts so tests can exercise controls while only their HTML is available. */
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
