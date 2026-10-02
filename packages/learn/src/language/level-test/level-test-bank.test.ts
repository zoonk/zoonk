import { describe, expect, it, vi } from "vitest";
import {
  INITIAL_BANK_WAIT,
  askedBankWait,
  isBankStopped,
  toBankRun,
  updateBankWait,
} from "./level-test-bank";

const ASKED_AT = Date.parse("2026-09-28T10:00:00Z");

/** Runs claim a pair's questions within seconds; one that hasn't after 45 s was lost. */
const BANK_START_MS = 45_000;

const idle = { expectedSeconds: 120, startedAt: null, status: "preparing" as const };
const writing = { ...idle, startedAt: "2026-09-28T10:00:03Z" };

function run(
  wait: Parameters<typeof toBankRun>[0]["wait"],
  poll: "failed" | "polling" = "polling",
) {
  return toBankRun({ poll, recheck: vi.fn(), retry: vi.fn(), wait });
}

describe(toBankRun, () => {
  it("waits for the run it asked for until it claims the questions", () => {
    const asked = askedBankWait({ now: ASKED_AT, preparing: idle, started: true });
    expect(run(asked)).toMatchObject({ failure: null, status: "waiting" });

    const claimed = updateBankWait({ now: ASKED_AT + 3000, preparing: writing, wait: asked });

    expect(run(claimed)).toMatchObject({
      status: "following",
      steps: { writeLevelTestBank: "started" },
    });
  });

  it("says the start failed when asking didn't go through", () => {
    const asked = askedBankWait({ now: ASKED_AT, preparing: idle, started: false });

    expect(run(asked)).toMatchObject({ failure: "notStarted", status: "failed" });
    expect(isBankStopped(asked)).toBe(true);
  });

  it("says the start failed when the run it asked for never claims the questions", () => {
    const asked = askedBankWait({ now: ASKED_AT, preparing: idle, started: true });
    const soon = updateBankWait({ now: ASKED_AT + BANK_START_MS, preparing: idle, wait: asked });
    const late = updateBankWait({ now: ASKED_AT + BANK_START_MS + 1, preparing: idle, wait: soon });

    expect(run(soon).status).toBe("waiting");
    expect(run(late)).toMatchObject({ failure: "notStarted", status: "failed" });
  });

  it("says writing stopped when the writer it saw lets go without finishing", () => {
    const followed = updateBankWait({ now: ASKED_AT, preparing: writing, wait: INITIAL_BANK_WAIT });
    const stopped = updateBankWait({ now: ASKED_AT + 3000, preparing: idle, wait: followed });

    expect(run(followed).status).toBe("following");
    expect(run(stopped)).toMatchObject({ failure: "generation", status: "failed" });
    expect(isBankStopped(stopped)).toBe(true);
  });

  it("offers to check again once checking keeps failing, while writing may go on", () => {
    const followed = updateBankWait({ now: ASKED_AT, preparing: writing, wait: INITIAL_BANK_WAIT });

    expect(run(followed, "failed")).toMatchObject({
      failure: "connection",
      status: "failed",
      steps: { writeLevelTestBank: "started" },
    });

    expect(isBankStopped(followed)).toBe(false);
  });
});
