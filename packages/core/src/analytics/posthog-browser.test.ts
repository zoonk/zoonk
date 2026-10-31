import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => {
  const config = { persistence: "" };

  return {
    config,
    get_property: vi.fn<(name: string) => unknown>(),
    has_opted_out_capturing: vi.fn(() => false),
    init: vi.fn((_token: string, options: { persistence: string }) => {
      config.persistence = options.persistence;
    }),
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
    reset: vi.fn(),
    set_config: vi.fn((options: { persistence: string }) => {
      config.persistence = options.persistence;
    }),
    startSessionRecording: vi.fn(),
    stopSessionRecording: vi.fn(),
  };
});

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

describe("PostHog in the browser", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://posthog.test");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "project-token");
    vi.stubGlobal("document", { readyState: "complete" });
    vi.stubGlobal("requestIdleCallback", (callback: () => void) => setTimeout(callback, 0));
    client.get_property.mockReturnValue("anonymous");
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

  it("starts with recording off, and records only an adult", async () => {
    const posthog = await loadModule();

    await posthog.startPostHog({ age: null });

    expect(client.init).toHaveBeenCalledExactlyOnceWith("project-token", {
      api_host: "https://posthog.test",
      defaults: "2026-05-30",
      disable_session_recording: true,
      persistence: "localStorage+cookie",
    });

    expect(client.startSessionRecording).not.toHaveBeenCalled();

    await posthog.startPostHog({ age: "adult" });

    expect(client.init).toHaveBeenCalledOnce();
    expect(client.startSessionRecording).toHaveBeenCalledOnce();
    await expect(posthog.loadPostHog()).resolves.toBe(client);
  });

  it("opts out once turned off, and back in without an event when turned on again", async () => {
    const posthog = await loadModule();
    await posthog.startPostHog({ age: "adult" });

    await posthog.stopPostHog();

    expect(client.stopSessionRecording).toHaveBeenCalledWith();
    expect(client.opt_out_capturing).toHaveBeenCalledOnce();
    await expect(posthog.loadPostHog()).resolves.toBeNull();

    client.has_opted_out_capturing.mockReturnValueOnce(true);
    await posthog.startPostHog({ age: null });

    expect(client.opt_in_capturing).toHaveBeenCalledExactlyOnceWith({ captureEventName: false });
  });

  it("drops the identity this browser holds for anyone not known to be an adult", async () => {
    client.get_property.mockReturnValue("identified");
    const posthog = await loadModule();

    await posthog.startPostHog({ age: "adult" });
    expect(client.reset).not.toHaveBeenCalled();

    await posthog.startPostHog({ age: null });
    expect(client.reset).toHaveBeenCalledOnce();
  });

  it("keeps a minor's random ID in this tab alone", async () => {
    const posthog = await loadModule();

    await posthog.startPostHog({ age: "minor" });

    expect(client.init).toHaveBeenCalledWith(
      "project-token",
      expect.objectContaining({ persistence: "sessionStorage" }),
    );

    expect(client.reset).not.toHaveBeenCalled();
    expect(client.startSessionRecording).not.toHaveBeenCalled();
  });

  it("drops the IDs a learner had before or after being known as a minor", async () => {
    const posthog = await loadModule();
    await posthog.startPostHog({ age: null });

    await posthog.startPostHog({ age: "minor" });

    expect(client.set_config).toHaveBeenLastCalledWith({ persistence: "sessionStorage" });
    expect(client.reset).toHaveBeenCalledExactlyOnceWith({ resetDeviceID: true });

    await posthog.startPostHog({ age: "adult" });

    expect(client.set_config).toHaveBeenLastCalledWith({ persistence: "localStorage+cookie" });
    expect(client.reset).toHaveBeenLastCalledWith({ resetDeviceID: true });
    expect(client.reset).toHaveBeenCalledTimes(2);
  });

  it("never loads when the visitor says no before the page has loaded", async () => {
    const listeners: (() => void)[] = [];
    vi.stubGlobal("document", { readyState: "loading" });

    vi.stubGlobal("addEventListener", (_type: string, listener: () => void) => {
      listeners.push(listener);
    });

    const posthog = await loadModule();
    const start = posthog.startPostHog({ age: "adult" });
    const stop = posthog.stopPostHog();

    listeners.forEach((listener) => listener());
    await Promise.all([start, stop]);

    expect(client.init).not.toHaveBeenCalled();
  });

  it("tells other analytics whether the page shares, even without PostHog", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "");
    const posthog = await loadModule();

    await posthog.startPostHog({ age: "minor" });
    expect(posthog.isSharingUsageData()).toBe(true);

    await posthog.stopPostHog();
    expect(posthog.isSharingUsageData()).toBe(false);
  });

  it("lets logging out reset without waiting for a decision that never comes", async () => {
    const posthog = await loadModule();

    await expect(settled(posthog.getStartedPostHog())).resolves.toBeNull();
  });
});
