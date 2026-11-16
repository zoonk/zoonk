import { type Page } from "@playwright/test";
import { stopRuns } from "../../../apps/main/e2e/generation-run.ts";
import { type Scenario } from "./shape.mts";

export async function installFailure({
  failure,
  page,
}: {
  failure: Scenario["failure"];
  page: Page;
}) {
  if (failure === "plan-build") {
    await stopRuns({ page });
  }

  if (failure === "mock-save") {
    await page.route("**/*", (route) => {
      const request = route.request();

      return request.method() === "POST" &&
        request.headers()["next-action"] &&
        (request.postData() ?? "").includes('"itemId"')
        ? route.abort()
        : route.fallback();
    });
  }
}
