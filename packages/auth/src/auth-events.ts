import { safeAsync } from "@zoonk/utils/error";

export type SignInMethod = "apple" | "google" | "otp";

export type AuthEvent =
  | { method: SignInMethod; name: "sign-in"; userId: string }
  | { name: "sign-up"; userId: string };

type AuthEventSink = (event: AuthEvent) => Promise<void>;

declare global {
  /** Next.js bundles instrumentation and routes separately, so a module variable set in `register()` isn't the one routes read. */
  var zoonkAuthEventSink: AuthEventSink | undefined;
}

/** Core's analytics depend on this package, so it can't call them itself. */
export function registerAuthEventSink(sink: AuthEventSink): void {
  globalThis.zoonkAuthEventSink = sink;
}

/** Analytics never fails a sign-in or sign-up. */
export async function reportAuthEvent(event: AuthEvent): Promise<void> {
  const sink = globalThis.zoonkAuthEventSink;

  if (!sink) {
    return;
  }

  await safeAsync(() => sink(event));
}
