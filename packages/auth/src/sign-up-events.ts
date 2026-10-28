import { safeAsync } from "@zoonk/utils/error";

type SignUp = { userId: string };
type SignUpSink = (event: SignUp) => Promise<void>;

declare global {
  /** Next.js bundles instrumentation and routes separately, so a module variable set in `register()` isn't the one routes read. */
  var zoonkSignUpSink: SignUpSink | undefined;
}

/** Core's analytics depend on this package, so it can't call them itself. */
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
