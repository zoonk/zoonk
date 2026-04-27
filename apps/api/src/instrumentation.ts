import { captureRequestError } from "@sentry/nextjs";
import { zoonkGateway } from "@zoonk/core/ai";

export async function register() {
  globalThis.AI_SDK_DEFAULT_PROVIDER = zoonkGateway;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = captureRequestError;
