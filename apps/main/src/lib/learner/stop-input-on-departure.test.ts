import { afterEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  checkIdentity: vi.fn(() => true),
  noteWitness: vi.fn(),
  registerIdentityCover: vi.fn(),
}));

// The store's other exports stay real: it connects to the summary store as it loads.
vi.mock("@/lib/learner/learner-identity", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...store,
}));

/** An element of the page, or of the cover's plane (`onCover`). */
class FakeElement {
  private readonly onCover: boolean;

  constructor(onCover: boolean) {
    this.onCover = onCover;
  }

  closest(selector: string) {
    return this.onCover && selector === "#zoonk-cover" ? this : null;
  }
}

/** A page event as the capture listener sees it (on the page or the cover), with what was done to it. */
function pageEvent({ onCover = false }: { onCover?: boolean } = {}) {
  vi.stubGlobal("Element", FakeElement);

  return {
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn(),
    target: new FakeElement(onCover),
  };
}

describe("stopInputOnDeparture", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    store.checkIdentity.mockReturnValue(true);
  });

  it("lets the learner's input through while the page is theirs", async () => {
    const { stopInputOnDeparture } = await import("./stop-input-on-departure");
    const event = pageEvent();

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Only the two methods the listener calls.
    stopInputOnDeparture(event as unknown as Event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopImmediatePropagation).not.toHaveBeenCalled();
  });

  it("stops the input before the page hears it once a departure was decided", async () => {
    store.checkIdentity.mockReturnValue(false);
    const { stopInputOnDeparture } = await import("./stop-input-on-departure");
    const event = pageEvent();

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Only the two methods the listener calls.
    stopInputOnDeparture(event as unknown as Event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopImmediatePropagation).toHaveBeenCalledOnce();
  });

  it("lets the cover's own Try again and Reload work while the page is covered", async () => {
    store.checkIdentity.mockReturnValue(false);
    const { stopInputOnDeparture } = await import("./stop-input-on-departure");
    const event = pageEvent({ onCover: true });

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Only what the listener reads.
    stopInputOnDeparture(event as unknown as Event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopImmediatePropagation).not.toHaveBeenCalled();
    expect(store.checkIdentity).not.toHaveBeenCalled();
  });
});
