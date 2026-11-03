import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentryHandlers = vi.hoisted(() => ({ onerror: vi.fn(), onunhandledrejection: vi.fn() }));

const sdk = vi.hoisted(() => ({
  captureException: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
  startSentry: vi.fn(() => {
    Object.assign(globalThis, sentryHandlers);
  }),
}));

/** The SDK sends to Sentry's servers; these tests check what reaches it and when. */
vi.mock("./sentry-sdk", () => sdk);

async function loadModule() {
  vi.resetModules();
  return import("./report-error");
}

function dispatch(type: string, fields: Record<string, unknown> = {}) {
  const event = Object.assign(new Event(type), fields);
  globalThis.dispatchEvent(event);
  return event;
}

async function settle() {
  await new Promise((resolve) => {
    setTimeout(resolve, 10);
  });
}

describe("Sentry in the browser", () => {
  beforeEach(() => {
    const window = new EventTarget();
    vi.stubGlobal("addEventListener", window.addEventListener.bind(window));
    vi.stubGlobal("removeEventListener", window.removeEventListener.bind(window));
    vi.stubGlobal("dispatchEvent", window.dispatchEvent.bind(window));
    vi.stubGlobal("window", globalThis);
    vi.stubGlobal("onerror", null);
    vi.stubGlobal("onunhandledrejection", null);
    vi.stubGlobal("document", { readyState: "loading" });
    vi.stubGlobal("requestIdleCallback", (callback: () => void) => setTimeout(callback, 0));
    vi.stubEnv("NODE_ENV", "production");
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("waits for the page to load, and traces navigations only from then", async () => {
    const sentry = await loadModule();
    sentry.startSentryAfterPageLoad();

    sentry.reportRouterTransition("/plan", "push");
    await settle();
    expect(sdk.startSentry).not.toHaveBeenCalled();

    dispatch("load");
    await vi.waitFor(() => expect(sdk.startSentry).toHaveBeenCalledOnce());

    sentry.reportRouterTransition("/today", "push");
    expect(sdk.captureRouterTransitionStart).toHaveBeenCalledExactlyOnceWith("/today", "push");
  });

  it("hands what was thrown before then to Sentry's own handler as it was, once, where it was thrown", async () => {
    const sentry = await loadModule();
    sentry.startSentryAfterPageLoad();

    dispatch("error", {
      colno: 7,
      error: "boom",
      filename: "/app.js",
      lineno: 3,
      message: "Uncaught boom",
    });

    await vi.waitFor(() =>
      expect(sentryHandlers.onerror).toHaveBeenCalledExactlyOnceWith(
        "Uncaught boom",
        "/app.js",
        3,
        7,
        "boom",
      ),
    );

    dispatch("error", { error: new Error("Sentry's own handler hears this one") });
    dispatch("load");
    await settle();

    expect(sdk.startSentry).toHaveBeenCalledOnce();
    expect(sentryHandlers.onerror).toHaveBeenCalledOnce();
  });

  it("hands a promise rejected before then to Sentry's own handler", async () => {
    const sentry = await loadModule();
    sentry.startSentryAfterPageLoad();

    const rejection = dispatch("unhandledrejection", { reason: new Error("rejected early") });

    await vi.waitFor(() =>
      expect(sentryHandlers.onunhandledrejection).toHaveBeenCalledExactlyOnceWith(rejection),
    );
  });

  it("keeps what it holds when Sentry fails to load offline, and sends it once the connection is back", async () => {
    sdk.startSentry.mockImplementationOnce(() => {
      throw new Error("the SDK's chunk didn't load");
    });

    const sentry = await loadModule();
    const shown = new Error("the page's error screen showed this");
    sentry.startSentryAfterPageLoad();
    sentry.reportError(shown);
    await settle();
    expect(sdk.captureException).not.toHaveBeenCalled();

    dispatch("online");

    await vi.waitFor(() => expect(sdk.captureException).toHaveBeenCalledExactlyOnceWith(shown));
  });

  it("reports nothing outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const sentry = await loadModule();

    sentry.reportError(new Error("local"));
    await settle();

    expect(sdk.startSentry).not.toHaveBeenCalled();
  });
});
