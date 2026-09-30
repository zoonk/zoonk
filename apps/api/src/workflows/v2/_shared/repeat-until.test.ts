import { describe, expect, it, vi } from "vitest";
import { repeatUntil } from "./repeat-until";

/** A run that returns the next of these results each time it's called. */
function counter(results: number[]) {
  const run = vi.fn(async () => results[run.mock.calls.length - 1] ?? 0);
  return run;
}

describe(repeatUntil, () => {
  it("stops at the first accepted result, waiting only between runs", async () => {
    const run = counter([1, 2, 3, 4]);
    const wait = vi.fn(async () => null);

    await expect(repeatUntil({ done: (value) => value === 3, run, times: 10, wait })).resolves.toBe(
      3,
    );

    expect(run).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it("returns the last result after running the given number of times", async () => {
    const run = counter([1, 2, 3, 4]);
    const wait = vi.fn(async () => null);

    await expect(repeatUntil({ done: () => false, run, times: 3, wait })).resolves.toBe(3);

    expect(run).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it("runs once without waiting when the first result is accepted", async () => {
    const run = counter([7]);
    const wait = vi.fn(async () => null);

    await expect(repeatUntil({ done: () => true, run, times: 5, wait })).resolves.toBe(7);

    expect(run).toHaveBeenCalledOnce();
    expect(wait).not.toHaveBeenCalled();
  });

  it("hands each run the result before it", async () => {
    const total = await repeatUntil<number>({
      done: (value) => value >= 10,
      run: async (previous = 0) => previous + 4,
      times: 5,
    });

    expect(total).toBe(12);
  });
});
