import { describe, expect, it } from "vitest";
import { type PollStatus } from "../../_utils/use-poll";
import { WAITING_RUN, hasWaitFailed } from "./wait-run";

describe(hasWaitFailed, () => {
  it.each<PollStatus>(["idle", "polling"])("keeps a healthy notice wait open while %s", (poll) => {
    expect(hasWaitFailed({ poll, run: WAITING_RUN })).toBe(false);
  });

  it.each<PollStatus>(["failed", "timedOut"])("offers recovery when the poll is %s", (poll) => {
    expect(hasWaitFailed({ poll, run: WAITING_RUN })).toBe(true);
  });

  it("offers recovery when the workflow failed even while polling continues", () => {
    expect(
      hasWaitFailed({
        poll: "polling",
        run: { failure: "connection", status: "failed", steps: {} },
      }),
    ).toBe(false);

    expect(
      hasWaitFailed({
        poll: "polling",
        run: { failure: "generation", status: "failed", steps: {} },
      }),
    ).toBe(true);
  });
});
