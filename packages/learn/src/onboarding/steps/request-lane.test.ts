import { describe, expect, it, vi } from "vitest";
import { createRequestLane } from "./request-lane";

describe(createRequestLane, () => {
  it("sends one request at a time, and only the latest of those asked while one is out", async () => {
    const lane = createRequestLane();
    const first = Promise.withResolvers<string>();
    const sent: string[] = [];

    const ask = (week: string, answer: Promise<string>, signal = new AbortController().signal) =>
      lane({
        request: () => {
          sent.push(week);
          return answer;
        },
        signal,
      });

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
});
