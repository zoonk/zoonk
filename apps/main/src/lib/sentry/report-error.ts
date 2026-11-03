import { createSharedImport } from "@/lib/shared-import";
import { afterPageLoad } from "@zoonk/utils/after-page-load";
import { type RouterTransitionType } from "next";

const importSentrySdk = () => import("./sentry-sdk");

type SentrySdk = Awaited<ReturnType<typeof importSentrySdk>>;
type Report = (sdk: SentrySdk) => void;

const importSdk = createSharedImport<SentrySdk>();
const held: Report[] = [];
let started: SentrySdk | null = null;

/**
 * Once it starts, Sentry's own handlers sit on `onerror` and `onunhandledrejection`, so an early
 * error reaches them as if it were thrown then.
 */
function holdUncaughtError(event: ErrorEvent) {
  hold(() => {
    // oxlint-disable-next-line typescript/no-unsafe-argument -- Whatever was thrown goes as it was; Sentry's handler reads values that aren't Errors too.
    globalThis.onerror?.(event.message, event.filename, event.lineno, event.colno, event.error);
  });
}

function holdUnhandledRejection(event: PromiseRejectionEvent) {
  hold(() => {
    globalThis.window.onunhandledrejection?.(event);
  });
}

function startWhenBackOnline() {
  void loadSdk().catch(() => null);
}

function loadSdk(): Promise<SentrySdk> {
  return importSdk(async () => {
    const sdk = await importSentrySdk();
    sdk.startSentry();
    globalThis.removeEventListener("error", holdUncaughtError);
    globalThis.removeEventListener("unhandledrejection", holdUnhandledRejection);
    globalThis.removeEventListener("online", startWhenBackOnline);
    started = sdk;
    held.splice(0).forEach((report) => report(sdk));
    return sdk;
  });
}

function hold(report: Report) {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  if (started) {
    report(started);
    return;
  }

  held.push(report);
  void loadSdk().catch(() => null);
}

/**
 * Sentry's SDK is one of the biggest scripts on every page, so it waits until the page has loaded
 * and is idle. An error before then loads it at once and is held until it has, and a load that
 * failed offline tries again once the connection is back.
 */
export function startSentryAfterPageLoad() {
  globalThis.addEventListener("error", holdUncaughtError);
  globalThis.addEventListener("unhandledrejection", holdUnhandledRejection);
  globalThis.addEventListener("online", startWhenBackOnline);

  void afterPageLoad()
    .then(loadSdk)
    .catch(() => null);
}

export function reportError(error: unknown) {
  hold((sdk) => sdk.captureException(error));
}

export function reportRouterTransition(url: string, navigationType: RouterTransitionType) {
  started?.captureRouterTransitionStart(url, navigationType);
}
