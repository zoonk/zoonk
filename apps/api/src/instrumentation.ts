import { captureRequestError } from "@sentry/nextjs";
import { zoonkDefaultProvider } from "@zoonk/core/ai";

export async function register() {
  globalThis.AI_SDK_DEFAULT_PROVIDER = zoonkDefaultProvider;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");

    const [
      { registerServerSinks },
      // Imported here only: `workflow/api` is Node-only, and this file also compiles for the edge.
      { registerFailedRunReports },
      { registerFollowUpRuns },
    ] = await Promise.all([
      import("@zoonk/core/server-sinks"),
      import("@/workflows/_shared/report-failed-runs"),
      import("@/workflows/follow-ups/register-follow-up-runs"),
    ]);

    registerServerSinks();
    registerFailedRunReports();
    registerFollowUpRuns();
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = captureRequestError;
