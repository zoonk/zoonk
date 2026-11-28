import { type Page, type Request } from "@playwright/test";

function isGoalAction(request: Request, goalId: string): boolean {
  return (
    request.method() === "POST" &&
    Boolean(request.headers()["next-action"]) &&
    (request.postData() ?? "").includes(goalId)
  );
}

/**
 * On a wait for a test's questions, runs `writeQuestions` and refuses the start the wait makes once
 * they arrive, as a dropped connection would. The wait's own checks are held while the questions
 * are being written, since a check that reads half of them says there is nothing to ask. Returns
 * whether a start was refused.
 */
export async function refuseStartAfterWait({
  goalId,
  page,
  writeQuestions,
}: {
  goalId: string;
  page: Page;
  writeQuestions: () => Promise<unknown>;
}): Promise<() => boolean> {
  const check = await page.waitForRequest((request) => isGoalAction(request, goalId));
  const checkId = check.headers()["next-action"];
  const { promise: written, resolve: markWritten } = Promise.withResolvers<null>();
  let refused = false;

  await page.route("**/*", async (route) => {
    const request = route.request();

    if (!isGoalAction(request, goalId)) {
      await route.fallback();
      return;
    }

    await written;

    if (refused || request.headers()["next-action"] === checkId) {
      await route.fallback();
      return;
    }

    refused = true;
    await route.abort("connectionfailed");
  });

  const checked = await check.response();
  await checked?.finished();
  await writeQuestions();
  markWritten(null);

  return () => refused;
}
