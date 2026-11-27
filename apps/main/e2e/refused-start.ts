import { type Page, type Request } from "@playwright/test";

function isGoalAction(request: Request, goalId: string): boolean {
  return (
    request.method() === "POST" &&
    Boolean(request.headers()["next-action"]) &&
    (request.postData() ?? "").includes(goalId)
  );
}

/**
 * On a wait for a test's questions, refuses the next Server Action for the goal that isn't the
 * wait's own check, as a dropped connection would: the start the wait makes once the questions
 * arrive. The checks still go through, so the questions arrive. Returns whether it refused one.
 */
export async function refuseStartAfterWait(page: Page, goalId: string): Promise<() => boolean> {
  const check = await page.waitForRequest((request) => isGoalAction(request, goalId));
  const checkId = check.headers()["next-action"];
  let refused = false;

  await page.route("**/*", async (route) => {
    const request = route.request();

    if (refused || !isGoalAction(request, goalId) || request.headers()["next-action"] === checkId) {
      await route.fallback();
      return;
    }

    refused = true;
    await route.abort("connectionfailed");
  });

  return () => refused;
}
