import { describe, expect, it, vi } from "vitest";
import { createSharedImport } from "./shared-import";

describe(createSharedImport, () => {
  it("loads once, whoever asks first, and gives every later caller the same load", async () => {
    const load = vi.fn(async () => ({ value: 1 }));
    const sharedImport = createSharedImport<{ value: number }>();

    const first = sharedImport(load);
    const second = sharedImport(load);

    expect(second).toBe(first);
    await expect(first).resolves.toStrictEqual({ value: 1 });
    expect(load).toHaveBeenCalledOnce();
  });

  it("forgets a load that failed, so the next one tries again", async () => {
    const sharedImport = createSharedImport<string>();
    const failed = sharedImport(() => Promise.reject(new Error("offline")));

    await expect(failed).rejects.toThrow("offline");
    await expect(sharedImport(async () => "loaded")).resolves.toBe("loaded");
  });
});
