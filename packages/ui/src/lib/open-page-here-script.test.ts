import { runInThisContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OPEN_PAGE_HERE_SCRIPT } from "./open-page-here-script";

function streamElement() {
  const segment = document.createElement("div");
  const element = document.createElement("div");
  const script = document.createElement("script");
  const scrollIntoView = vi.fn();

  // jsdom lays nothing out, so the element has boxes only once it's out of the hidden segment.
  Object.assign(element, {
    getClientRects: () => (element.closest("[hidden]") ? [] : [{}]),
    scrollIntoView,
  });

  segment.hidden = true;
  element.append(script);
  segment.append(element);
  document.body.append(segment);

  vi.spyOn(document, "currentScript", "get").mockReturnValue(script);
  runInThisContext(OPEN_PAGE_HERE_SCRIPT);

  return { reveal: () => document.body.append(element), scrollIntoView };
}

describe("opening a streamed page at an element", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it("scrolls the element into view once the page reveals it, and only then", async () => {
    const { reveal, scrollIntoView } = streamElement();

    document.body.append(document.createElement("p"));
    await Promise.resolve();
    expect(scrollIntoView).not.toHaveBeenCalled();

    reveal();
    await Promise.resolve();
    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ behavior: "instant", block: "start" });

    document.body.append(document.createElement("p"));
    await Promise.resolve();
    expect(scrollIntoView).toHaveBeenCalledOnce();
  });

  it("stops waiting for an element the page never reveals", async () => {
    vi.useFakeTimers();
    const { reveal, scrollIntoView } = streamElement();

    vi.advanceTimersByTime(10_000);
    reveal();
    await Promise.resolve();

    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
