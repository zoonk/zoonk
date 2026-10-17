import { safeAsync } from "@zoonk/utils/error";

/** An account Better Auth just created for a learner, not a guest. */
type SignUp = { userId: string };
type SignUpSink = (event: SignUp) => Promise<void>;

declare global {
  /**
   * Lives on `globalThis` like the subscription sink: Next.js bundles instrumentation and routes
   * separately, so a module variable set in `register()` isn't the one sign-ups would read.
   */
  var zoonkSignUpSink: SignUpSink | undefined;
}

/**
 * Lets each app that serves Better Auth send sign-ups to analytics. Core's analytics depend on
 * this package, so it can't call them itself.
 */
export function registerSignUpSink(sink: SignUpSink): void {
  globalThis.zoonkSignUpSink = sink;
}

/** Analytics never fails a sign-up. */
export async function reportSignUp(event: SignUp): Promise<void> {
  const sink = globalThis.zoonkSignUpSink;

  if (!sink) {
    return;
  }

  await safeAsync(() => sink(event));
}
