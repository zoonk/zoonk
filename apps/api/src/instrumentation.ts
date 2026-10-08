import { captureRequestError } from "@sentry/nextjs";
import { zoonkDefaultProvider } from "@zoonk/core/ai";

export async function register() {
  globalThis.AI_SDK_DEFAULT_PROVIDER = zoonkDefaultProvider;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");

    const [
      { registerAiGenerationAnalytics },
      { registerAiCallLog },
      { registerSubscriptionAnalytics },
      { registerEvaluationRunLog },
    ] = await Promise.all([
      import("@zoonk/core/analytics/ai-generations"),
      import("@zoonk/core/ai-calls/log"),
      import("@zoonk/core/analytics/subscription-events"),
      import("@zoonk/core/evaluation-runs/log"),
    ]);

    registerAiGenerationAnalytics();
    registerAiCallLog();
    registerSubscriptionAnalytics();
    registerEvaluationRunLog();
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = captureRequestError;
