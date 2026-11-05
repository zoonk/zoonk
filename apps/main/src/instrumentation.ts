import { captureRequestError } from "@sentry/nextjs";
import { zoonkDefaultProvider } from "@zoonk/core/ai";

export async function register() {
  globalThis.AI_SDK_DEFAULT_PROVIDER = zoonkDefaultProvider;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");

    const { registerServerSinks } = await import("@zoonk/core/server-sinks");
    // Better Auth serves sign-ins, sign-ups and Stripe's webhooks here as well as in the API.
    registerServerSinks();
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = captureRequestError;
