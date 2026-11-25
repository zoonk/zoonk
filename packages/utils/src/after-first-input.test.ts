import { afterEach, describe, expect, it, vi } from "vitest";

type Listener = (event: { isTrusted: boolean }) => void;

async function loadModule() {
  const listeners = new Map<string, Listener[]>();

  vi.stubGlobal("addEventListener", (type: string, listener: Listener) => {
    listeners.set(type, [...(listeners.get(type) ?? []), listener]);
  });

  vi.resetModules();
  const firstInput = await import("./after-first-input");

  const dispatch = (type: string, isTrusted: boolean) => {
    listeners.get(type)?.forEach((listener) => listener({ isTrusted }));
  };

  return { ...firstInput, dispatch };
}

async function settled(promise: Promise<void>): Promise<"done" | "pending"> {
  return Promise.race([
    promise.then(() => "done" as const),
    new Promise<"pending">((resolve) => {
      setTimeout(resolve, 20, "pending");
    }),
  ]);
}

describe("after the first input", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("waits for input the browser reports as the person's own", async () => {
    const { afterFirstInput: wait, dispatch, hadFirstInput } = await loadModule();
    const firstInput = wait();

    dispatch("pointerdown", false);

    await expect(settled(firstInput)).resolves.toBe("pending");
    expect(hadFirstInput()).toBe(false);

    dispatch("wheel", true);

    await expect(settled(firstInput)).resolves.toBe("done");
    expect(hadFirstInput()).toBe(true);
    await expect(settled(wait())).resolves.toBe("done");
  });
});
