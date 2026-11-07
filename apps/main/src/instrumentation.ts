import { captureRequestError } from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");

    // Imported here only: Next also builds this file for the edge runtime, which can't load them.
    const [{ zoonkDefaultProvider }, { registerServerSinks }] = await Promise.all([
      import("@zoonk/core/ai"),
      import("@zoonk/core/server-sinks"),
    ]);

    globalThis.AI_SDK_DEFAULT_PROVIDER = zoonkDefaultProvider;
    // Better Auth serves sign-ins, sign-ups and Stripe's webhooks here as well as in the API.
    registerServerSinks();
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = captureRequestError;
