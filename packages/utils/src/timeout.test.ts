import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { settleWithin } from "./timeout";

function answerAfter<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), ms);
  });
}

describe(settleWithin, () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the value of a request that answers in time", async () => {
    const settled = settleWithin({ ms: 1000, request: () => answerAfter(400, "graded") });
    await vi.advanceTimersByTimeAsync(400);

    await expect(settled).resolves.toStrictEqual({ status: "settled", value: "graded" });
  });

  it("gives up once the time is over, and ignores a later answer", async () => {
    const settled = settleWithin({ ms: 1000, request: () => answerAfter(5000, "late") });
    await vi.advanceTimersByTimeAsync(1000);

    await expect(settled).resolves.toStrictEqual({ status: "timedOut" });

    await vi.advanceTimersByTimeAsync(5000);
    await expect(settled).resolves.toStrictEqual({ status: "timedOut" });
  });

  it("passes a failed request's error through", async () => {
    const settled = settleWithin({ ms: 1000, request: () => Promise.reject(new Error("offline")) });

    await expect(settled).rejects.toThrow("offline");
  });

  it("passes an error thrown before the request starts", async () => {
    const settled = settleWithin({
      ms: 1000,
      request: () => {
        throw new Error("bad input");
      },
    });

    await expect(settled).rejects.toThrow("bad input");
  });
});
