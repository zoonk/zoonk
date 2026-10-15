import { describe, expect, it, vi } from "vitest";
import { whenShown } from "./when-shown";

/** A page the test shows and hides by hand. */
function fakePage({ prerendering = false, visible = true } = {}) {
  const events = new EventTarget();

  const page = {
    addEventListener: events.addEventListener.bind(events),
    prerendering,
    visibilityState: (visible ? "visible" : "hidden") as DocumentVisibilityState,
  };

  const show = () => {
    page.prerendering = false;
    page.visibilityState = "visible";
    events.dispatchEvent(new Event("prerenderingchange"));
    events.dispatchEvent(new Event("visibilitychange"));
  };

  return { page, show };
}

describe(whenShown, () => {
  it("runs at once on a page in view", () => {
    const run = vi.fn();
    whenShown(run, fakePage().page);
    expect(run).toHaveBeenCalledOnce();
  });

  it("waits while the tab is in the background, then runs once on its first show", () => {
    const run = vi.fn();
    const { page, show } = fakePage({ visible: false });

    whenShown(run, page);
    expect(run).not.toHaveBeenCalled();

    show();
    show();
    expect(run).toHaveBeenCalledOnce();
  });

  it("never runs while the browser only prepares the page ahead", () => {
    const run = vi.fn();
    const { page, show } = fakePage({ prerendering: true });

    whenShown(run, page);
    expect(run).not.toHaveBeenCalled();

    show();
    expect(run).toHaveBeenCalledOnce();
  });

  it("stops waiting when the screen leaves first", () => {
    const run = vi.fn();
    const { page, show } = fakePage({ visible: false });

    whenShown(run, page)();
    show();
    expect(run).not.toHaveBeenCalled();
  });
});
