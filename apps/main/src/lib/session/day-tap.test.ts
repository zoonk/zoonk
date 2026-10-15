import { beforeEach, describe, expect, it, vi } from "vitest";
import { type DayOpenOutcome, openStudyDayAction } from "./day-open-action";
import { sendDayOpen, toDestinationResult, toTapResult } from "./day-tap";

/** The open is a request to the server: each test answers it as the server would. */
vi.mock("./day-open-action", () => ({ openStudyDayAction: vi.fn() }));

const INPUT = {
  goalId: "8f5c7f31-35c4-4c35-b31c-2f2ae45d6e3a",
  shownDate: "2026-10-15",
  timeZone: "UTC",
};

const OPENED: DayOpenOutcome = {
  actorId: "learner",
  destination: { blockId: "block", kind: "session" },
  revision: "8",
  sessionId: "session",
  status: "opened",
  targetStatus: "next",
};

const RETRYABLE: DayOpenOutcome = { actorId: "learner", revision: "7", status: "retryable" };

describe(sendDayOpen, () => {
  beforeEach(() => {
    vi.mocked(openStudyDayAction).mockReset();
  });

  it("sends once more, in a request of its own, after losing a race", async () => {
    vi.mocked(openStudyDayAction).mockResolvedValueOnce(RETRYABLE).mockResolvedValueOnce(OPENED);

    await expect(sendDayOpen({ input: INPUT, stillHere: () => true })).resolves.toBe(OPENED);
    expect(openStudyDayAction).toHaveBeenCalledTimes(2);
    expect(openStudyDayAction).toHaveBeenNthCalledWith(2, INPUT);
  });

  it("never sends a third time: a second loss is the tap's failure", async () => {
    vi.mocked(openStudyDayAction).mockResolvedValue(RETRYABLE);

    const outcome = await sendDayOpen({ input: INPUT, stillHere: () => true });

    expect(openStudyDayAction).toHaveBeenCalledTimes(2);
    expect(toTapResult(outcome)).toStrictEqual({ kind: "failed" });
  });

  it("doesn't try again once the learner left the screen the tap was made on", async () => {
    vi.mocked(openStudyDayAction).mockResolvedValue(RETRYABLE);

    await sendDayOpen({ input: INPUT, stillHere: () => false });
    expect(openStudyDayAction).toHaveBeenCalledOnce();
  });

  it("tries again only once its page says it may, as a bare open waits to be shown again", async () => {
    vi.mocked(openStudyDayAction).mockResolvedValueOnce(RETRYABLE).mockResolvedValueOnce(OPENED);
    const shown = Promise.withResolvers<boolean>();

    const outcome = sendDayOpen({ input: INPUT, stillHere: () => shown.promise });

    await vi.waitFor(() => expect(openStudyDayAction).toHaveBeenCalledOnce());
    shown.resolve(true);

    await expect(outcome).resolves.toBe(OPENED);
    expect(openStudyDayAction).toHaveBeenCalledTimes(2);
  });
});

describe(toTapResult, () => {
  it("goes where the started step plays", () => {
    expect(toTapResult(OPENED)).toStrictEqual({
      destination: { blockId: "block", kind: "session" },
      kind: "go",
    });
  });

  it("reads the screen again when nothing started: the step changed, the day was empty, the goal stopped", () => {
    expect(toTapResult({ ...OPENED, destination: null, targetStatus: "changed" })).toStrictEqual({
      kind: "refresh",
    });

    expect(toTapResult({ actorId: "learner", revision: "7", status: "empty" })).toStrictEqual({
      kind: "refresh",
    });

    expect(toTapResult({ status: "goalNotActive" })).toStrictEqual({ kind: "refresh" });
  });

  it("fails when the open failed", () => {
    expect(toTapResult({ status: "failed" })).toStrictEqual({ kind: "failed" });
  });
});

describe(toDestinationResult, () => {
  it("fails without a destination, and opens nothing for a changed step", () => {
    expect(toDestinationResult(null)).toStrictEqual({ kind: "failed" });
    expect(toDestinationResult({ kind: "changed" })).toStrictEqual({ kind: "refresh" });

    expect(toDestinationResult({ kind: "today" })).toStrictEqual({
      destination: { kind: "today" },
      kind: "go",
    });
  });
});
