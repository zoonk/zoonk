import { describe, expect, it } from "vitest";
import { createVisibleWait } from "./visible-wait";

describe(createVisibleWait, () => {
  it("keeps visible segments and leaves time in another tab out of idle time", () => {
    const wait = createVisibleWait({ at: 1000, visible: true });
    const first = wait.end(4000);
    expect(first).toStrictEqual({ endedAt: 4000, startedAt: 1000 });
    expect(wait.end(8000)).toBeNull();
    wait.show(10_000);
    wait.show(11_000);
    expect(wait.end(12_000)).toStrictEqual({ endedAt: 12_000, startedAt: 10_000 });
  });

  it("records an abandoned screen once even when pagehide, hiding and unmount all end it", () => {
    const wait = createVisibleWait({ at: 1000, visible: true });
    expect(wait.end(2000)).toStrictEqual({ endedAt: 2000, startedAt: 1000 });
    expect(wait.end(2001)).toBeNull();
    expect(wait.end(2002)).toBeNull();
  });

  it("does not start a hidden screen or count a zero-length strict-mode replay", () => {
    const wait = createVisibleWait({ at: 1000, visible: false });
    expect(wait.end(4000)).toBeNull();
    wait.show(5000);
    expect(wait.end(5000)).toBeNull();
    wait.show(5000);
    expect(wait.end(6000)).toStrictEqual({ endedAt: 6000, startedAt: 5000 });
  });
});
