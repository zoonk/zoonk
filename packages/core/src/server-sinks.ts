import "server-only";
import { registerAiGenerationSink } from "@zoonk/ai/ai-generation-sink";
import { registerEvaluationRunSink } from "@zoonk/ai/evaluation-run-sink";
import { registerAuthEventSink } from "@zoonk/auth/auth-events";
import { registerSubscriptionChangeSink } from "@zoonk/auth/subscription-events";

/**
 * For instrumentation's `register()`, which runs before the first request of every server, each
 * region's proxy included. A sink loads its code on its first event, so startup stays light.
 */
export function registerServerSinks(): void {
  registerAiGenerationSink("posthog", async (generation) => {
    const { sendAiGenerationAnalytics } = await import("./analytics/ai-generations");
    await sendAiGenerationAnalytics(generation);
  });

  registerAiGenerationSink("ai-calls", async (generation) => {
    const { logAiCall } = await import("./ai-calls/ai-call-log");
    logAiCall(generation);
  });

  registerAuthEventSink(async (event) => {
    const { trackAuthEvent } = await import("./analytics/auth-events");
    trackAuthEvent(event);
  });

  registerSubscriptionChangeSink(async (change) => {
    const { trackSubscriptionChange } = await import("./analytics/subscription-events");
    await trackSubscriptionChange(change);
  });

  registerEvaluationRunSink(async (run) => {
    const { recordEvaluationRun } = await import("./evaluation-runs/evaluation-run-log");
    await recordEvaluationRun(run);
  });
}
