import { captureRequestError } from "@sentry/nextjs";
import { zoonkDefaultProvider } from "@zoonk/core/ai";

export async function register() {
  globalThis.AI_SDK_DEFAULT_PROVIDER = zoonkDefaultProvider;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");

    const [
      { registerAiGenerationAnalytics },
      { registerAiCallLog },
      { registerSignUpAnalytics },
      { registerSubscriptionAnalytics },
      { registerEvaluationRunLog },
      // Imported here only: `workflow/api` is Node-only, and this file also compiles for the edge.
      { registerFailedRunReports },
    ] = await Promise.all([
      import("@zoonk/core/analytics/ai-generations"),
      import("@zoonk/core/ai-calls/log"),
      import("@zoonk/core/analytics/sign-up-events"),
      import("@zoonk/core/analytics/subscription-events"),
      import("@zoonk/core/evaluation-runs/log"),
      import("@/workflows/_shared/report-failed-runs"),
    ]);

    registerAiGenerationAnalytics();
    registerAiCallLog();
    registerSignUpAnalytics();
    registerSubscriptionAnalytics();
    registerEvaluationRunLog();
    registerFailedRunReports();
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = captureRequestError;
