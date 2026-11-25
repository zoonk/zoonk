import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({
  has_opted_out_capturing: vi.fn(() => false),
  init: vi.fn(),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
  startSessionRecording: vi.fn(),
  stopSessionRecording: vi.fn(),
}));

vi.mock("posthog-js", () => ({ default: client }));

async function loadModule() {
  vi.resetModules();
  return import("./posthog-browser");
}

/** Settles the pending microtasks, so a promise that would resolve has. */
async function settled<T>(promise: Promise<T>): Promise<T | "pending"> {
  return Promise.race([
    promise,
    new Promise<"pending">((resolve) => {
      setTimeout(resolve, 20, "pending");
    }),
  ]);
}

type Listener = (event: { isTrusted: boolean }) => void;
const listeners = new Map<string, Listener[]>();

function dispatch(type: string, isTrusted = true) {
  listeners.get(type)?.forEach((listener) => listener({ isTrusted }));
}

describe("PostHog in the browser", () => {
  beforeEach(() => {
    listeners.clear();

    vi.stubGlobal("addEventListener", (type: string, listener: Listener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    });

    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://posthog.test");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "project-token");
    vi.stubGlobal("document", { readyState: "complete" });
    vi.stubGlobal("requestIdleCallback", (callback: () => void) => setTimeout(callback, 0));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("loads nothing and holds events until the page decides", async () => {
    const posthog = await loadModule();

    await expect(settled(posthog.loadPostHog())).resolves.toBe("pending");
    expect(client.init).not.toHaveBeenCalled();
  });

  it("drops the events a decline held, and never loads", async () => {
    const posthog = await loadModule();
    const held = posthog.loadPostHog();

    await posthog.stopPostHog();

    await expect(held).resolves.toBeNull();
    expect(client.init).not.toHaveBeenCalled();
  });

  it("loads once and records the session of anyone who shares", async () => {
    const posthog = await loadModule();
    const start = posthog.startPostHog();

    dispatch("pointermove");
    await start;

    expect(client.init).toHaveBeenCalledExactlyOnceWith("project-token", {
      api_host: "https://posthog.test",
      defaults: "2026-05-30",
      disable_session_recording: true,
    });

    expect(client.startSessionRecording).toHaveBeenCalledOnce();

    await posthog.startPostHog();

    expect(client.init).toHaveBeenCalledOnce();
    await expect(posthog.loadPostHog()).resolves.toBe(client);
  });

  it("opts out once turned off, and back in without an event when turned on again", async () => {
    const posthog = await loadModule();
    const start = posthog.startPostHog();

    dispatch("keydown");
    await start;
    await posthog.stopPostHog();

    expect(client.stopSessionRecording).toHaveBeenCalledWith();
    expect(client.opt_out_capturing).toHaveBeenCalledOnce();
    await expect(posthog.loadPostHog()).resolves.toBeNull();

    client.has_opted_out_capturing.mockReturnValueOnce(true);
    await posthog.startPostHog();

    expect(client.opt_in_capturing).toHaveBeenCalledExactlyOnceWith({ captureEventName: false });
  });

  it("never loads when the visitor says no before the page has loaded", async () => {
    vi.stubGlobal("document", { readyState: "loading" });

    const posthog = await loadModule();
    const start = posthog.startPostHog();
    const stop = posthog.stopPostHog();

    dispatch("pointerdown");
    dispatch("load");
    await Promise.all([start, stop]);

    expect(client.init).not.toHaveBeenCalled();
  });

  it("never loads for a visit nobody touches, and lets it stop and log out at once", async () => {
    const posthog = await loadModule();
    const start = posthog.startPostHog();

    dispatch("pointerdown", false);

    await expect(settled(start)).resolves.toBe("pending");
    expect(client.init).not.toHaveBeenCalled();
    await expect(settled(posthog.getStartedPostHog())).resolves.toBeNull();
    await expect(settled(posthog.stopPostHog())).resolves.toBeUndefined();
    expect(client.opt_out_capturing).not.toHaveBeenCalled();
  });

  it("holds the events of a visit until its first input, then sends them", async () => {
    const posthog = await loadModule();
    void posthog.startPostHog();
    const held = posthog.loadPostHog();

    await expect(settled(held)).resolves.toBe("pending");

    dispatch("touchstart");

    await expect(held).resolves.toBe(client);
  });

  it("tells other analytics whether the page shares, even without PostHog", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "");
    const posthog = await loadModule();

    await posthog.startPostHog();
    expect(posthog.isSharingUsageData()).toBe(true);

    await posthog.stopPostHog();
    expect(posthog.isSharingUsageData()).toBe(false);
  });

  it("lets logging out reset without waiting for a decision that never comes", async () => {
    const posthog = await loadModule();

    await expect(settled(posthog.getStartedPostHog())).resolves.toBeNull();
  });
});
