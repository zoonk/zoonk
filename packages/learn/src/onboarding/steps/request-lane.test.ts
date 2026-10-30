import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequestLane } from "./request-lane";

function askAbout(lane: ReturnType<typeof createRequestLane<string>>, sent: string[]) {
  return (week: string, answer: Promise<string>, signal = new AbortController().signal) =>
    lane({
      key: week,
      request: () => {
        sent.push(week);
        return answer;
      },
      signal,
    });
}

describe(createRequestLane, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends one request at a time, and only the latest of those asked while one is out", async () => {
    const sent: string[] = [];
    const ask = askAbout(createRequestLane<string>(), sent);
    const first = Promise.withResolvers<string>();

    const replaced = new AbortController();
    const allDays = ask("every weekday", first.promise);
    const noFriday = ask("no Friday", Promise.resolve("no Friday"), replaced.signal);
    const noThursday = ask("no Thursday or Friday", Promise.resolve("no Thursday or Friday"));
    replaced.abort();

    await vi.waitFor(() => {
      expect(sent).toStrictEqual(["every weekday"]);
    });

    first.resolve("every weekday");

    await expect(Promise.all([allDays, noFriday, noThursday])).resolves.toStrictEqual([
      "every weekday",
      null,
      "no Thursday or Friday",
    ]);

    expect(sent).toStrictEqual(["every weekday", "no Thursday or Friday"]);
  });

  it("holds the lane until a request too slow to wait for settles, and joins a retry to it", async () => {
    vi.useFakeTimers();
    const sent: string[] = [];
    const ask = askAbout(createRequestLane<string>(), sent);
    const slow = Promise.withResolvers<string>();

    const first = ask("every weekday", slow.promise);
    await vi.advanceTimersByTimeAsync(45_000);
    await expect(first).resolves.toBeNull();

    const retry = ask("every weekday", Promise.resolve("sent again"));
    const noFriday = ask("no Friday", Promise.resolve("no Friday"));
    await vi.advanceTimersByTimeAsync(0);
    expect(sent).toStrictEqual(["every weekday"]);

    slow.resolve("every weekday");

    await expect(Promise.all([retry, noFriday])).resolves.toStrictEqual([
      "every weekday",
      "no Friday",
    ]);

    expect(sent).toStrictEqual(["every weekday", "no Friday"]);
  });
});
