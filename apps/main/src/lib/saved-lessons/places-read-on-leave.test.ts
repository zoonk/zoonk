import { describe, expect, it, vi } from "vitest";
import { placesReadOnLeave } from "./places-read-on-leave";

describe(placesReadOnLeave, () => {
  it("reads the places once the learner leaves after a save", () => {
    const read = vi.fn();
    const places = placesReadOnLeave(read);
    places.show();

    places.saved();
    expect(read).not.toHaveBeenCalled();

    places.leave();
    places.leave();
    expect(read).toHaveBeenCalledOnce();
  });

  it("reads them at once for a save that lands after the learner left", () => {
    const read = vi.fn();
    const places = placesReadOnLeave(read);
    places.show();
    places.leave();

    places.saved();

    expect(read).toHaveBeenCalledOnce();
  });

  it("waits again once the page shows again", () => {
    const read = vi.fn();
    const places = placesReadOnLeave(read);
    places.show();
    places.leave();
    places.show();

    places.saved();
    expect(read).not.toHaveBeenCalled();

    places.leave();
    expect(read).toHaveBeenCalledOnce();
  });
});
