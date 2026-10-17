import { describe, expect, it, vi } from "vitest";
import { checkRouter } from "./check-router";

type Router = Parameters<typeof checkRouter>[0];

/** A router that records what it was asked to do, in order. */
function recordingRouter() {
  const calls: string[] = [];

  const router = {
    back: () => calls.push("back"),
    forward: () => calls.push("forward"),
    prefetch: () => calls.push("prefetch"),
    push: (href: string) => calls.push(`push ${href}`),
    refresh: () => calls.push("refresh"),
    replace: (href: string) => calls.push(`replace ${href}`),
  };

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The typed routes don't matter to what the router records.
  return { calls, router: router as unknown as Router };
}

describe(checkRouter, () => {
  it("moves at once, in the caller's own call, while the page belongs to the browser's learner", () => {
    const { calls, router } = recordingRouter();
    const checked = checkRouter(router, () => true);

    checked.push("/plan");
    checked.replace("/today");
    checked.refresh();
    checked.back();
    checked.forward();

    expect(calls).toStrictEqual(["push /plan", "replace /today", "refresh", "back", "forward"]);
  });

  it("drops every move once a departure was decided", () => {
    const { calls, router } = recordingRouter();
    const check = vi.fn(() => false);
    const checked = checkRouter(router, check);

    checked.push("/plan");
    checked.replace("/today");
    checked.refresh();
    checked.back();
    checked.forward();

    expect(calls).toStrictEqual([]);
    expect(check).toHaveBeenCalledTimes(5);
  });

  it("leaves prefetching alone: a prefetch made under the cover shows nobody", () => {
    const { calls, router } = recordingRouter();
    const checked = checkRouter(router, () => false);

    checked.prefetch("/plan");

    expect(calls).toStrictEqual(["prefetch"]);
  });
});
