import { captureRequestError } from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");

    // Imported here only: Next also builds this file for the edge runtime, which can't load them.
    const [
      { zoonkDefaultProvider },
      { registerServerSinks },
      { registerFailedRunReports },
      { registerFollowUpRuns },
    ] = await Promise.all([
      import("@zoonk/core/ai"),
      import("@zoonk/core/server-sinks"),
      import("@/workflows/_shared/report-failed-runs"),
      import("@/workflows/follow-ups/register-follow-up-runs"),
    ]);

    globalThis.AI_SDK_DEFAULT_PROVIDER = zoonkDefaultProvider;
    registerServerSinks();
    registerFailedRunReports();
    registerFollowUpRuns();
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = captureRequestError;
