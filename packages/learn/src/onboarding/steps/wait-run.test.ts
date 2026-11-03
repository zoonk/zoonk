import { describe, expect, it } from "vitest";
import { type PollStatus } from "../../_utils/use-poll";
import { type GenerationRun } from "../../generation/generation-run";
import { WAITING_RUN, getNoticeStop, getPlanWait, getRevealWait } from "./wait-run";

function restart() {
  return null;
}

function retry() {
  return null;
}

describe(getNoticeStop, () => {
  it.each<PollStatus>(["idle", "polling"])(
    "keeps a healthy notice wait open while %s",
    (status) => {
      expect(getNoticeStop({ poll: { restart, status }, run: WAITING_RUN })).toBeNull();
    },
  );

  it.each<PollStatus>(["failed", "timedOut"])(
    "offers to reconnect when the poll is %s",
    (status) => {
      expect(getNoticeStop({ poll: { restart, status }, run: WAITING_RUN })).toStrictEqual({
        failure: "connection",
        retry: restart,
      });
    },
  );

  it("offers to try again when the run stopped, but not when only its updates did", () => {
    const poll = { restart, status: "polling" as const };

    expect(
      getNoticeStop({ poll, run: { failure: "connection", status: "failed", steps: {} } }),
    ).toBeNull();

    expect(
      getNoticeStop({ poll, run: { failure: "generation", retry, status: "failed", steps: {} } }),
    ).toStrictEqual({ failure: "generation", retry });
  });
});

describe(getPlanWait, () => {
  const following: GenerationRun = { failure: null, status: "following", steps: {} };
  const done: GenerationRun = { ...following, status: "ready" };
  const asking = { last: null, status: "polling" as const };
  const building = { readingNotice: false, ready: false };
  const reading = { readingNotice: true, ready: false };
  const ready = { readingNotice: false, ready: true };

  it("opens on the plan's wait before its first answer when the view says it can't answer yet", () => {
    expect(getPlanWait({ gate: asking, opened: building, run: following })).toBe("building");
    expect(getPlanWait({ gate: asking, opened: reading, run: following })).toBe("notice");
  });

  it("opens on the question before the plan's first answer when the view says it can answer", () => {
    expect(getPlanWait({ gate: asking, opened: ready, run: following })).toBeNull();
  });

  it("goes by the plan's answers once they come", () => {
    const answeredReady = { last: ready, status: "idle" as const };
    const answeredBuilding = { last: building, status: "polling" as const };

    expect(getPlanWait({ gate: answeredReady, opened: building, run: following })).toBeNull();
    expect(getPlanWait({ gate: answeredBuilding, opened: ready, run: following })).toBe("building");
  });

  it("keeps the view's wait until the plan's first answer, even once its run is done", () => {
    expect(getPlanWait({ gate: asking, opened: building, run: done })).toBe("building");
  });

  it("asks once the plan's run is done, even while the plan says it isn't ready", () => {
    const gate = { last: building, status: "polling" as const };
    expect(getPlanWait({ gate, opened: building, run: done })).toBeNull();
  });

  it("waits while the exam's notice is read, even once the run is done", () => {
    const gate = { last: reading, status: "polling" as const };
    expect(getPlanWait({ gate, opened: ready, run: done })).toBe("notice");
  });

  it("stays on the notice's wait when asking about its reading stopped", () => {
    const gate = { last: reading, status: "failed" as const };
    expect(getPlanWait({ gate, opened: reading, run: following })).toBe("notice");
  });
});

describe(getRevealWait, () => {
  const read = { notice: "usual" as const, ready: true };
  const reading = { notice: "reading" as const, ready: true };

  it("waits for the plan, then for its exam's notice, then shows it", () => {
    expect(getRevealWait(null)).toBe("building");
    expect(getRevealWait(reading)).toBe("notice");
    expect(getRevealWait(read)).toBeNull();
  });
});
