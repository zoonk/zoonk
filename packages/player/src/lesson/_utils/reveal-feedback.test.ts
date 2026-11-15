import { describe, expect, it } from "vitest";
import { getRevealDelta } from "./reveal-feedback";

const visible = { bottom: 700, top: 100 };

describe(getRevealDelta, () => {
  it("stays put when the feedback is already in sight", () => {
    const delta = getRevealDelta({
      chip: null,
      feedback: { bottom: 600, top: 500 },
      title: { bottom: 144, top: 116 },
      visible,
    });

    expect(delta).toBe(0);
  });

  it("shows the whole feedback, and the title too when it has the room", () => {
    const delta = getRevealDelta({
      chip: null,
      feedback: { bottom: 760, top: 660 },
      title: { bottom: 244, top: 216 },
      visible,
    });

    expect(delta).toBe(76);
  });

  it("lets the title scroll away when the whole feedback needs its room", () => {
    const delta = getRevealDelta({
      chip: null,
      feedback: { bottom: 900, top: 700 },
      title: { bottom: 184, top: 156 },
      visible,
    });

    expect(delta).toBe(216);
  });

  it("scrolls a title out whole when showing the feedback would cut it", () => {
    const title = { bottom: 172, top: 116 };

    const delta = getRevealDelta({
      chip: null,
      feedback: { bottom: 740, top: 600 },
      title,
      visible,
    });

    expect(delta).toBe(72);
    expect(title.bottom - delta).toBe(visible.top);
  });

  it("scrolls a chip out whole and keeps its title when showing the feedback would cut the chip", () => {
    const chip = { bottom: 138, top: 116 };

    const delta = getRevealDelta({
      chip,
      feedback: { bottom: 714, top: 600 },
      title: { bottom: 178, top: 150 },
      visible,
    });

    expect(delta).toBe(38);
    expect(chip.bottom - delta).toBeLessThanOrEqual(visible.top);
  });

  it("keeps a chip that stays whole", () => {
    const delta = getRevealDelta({
      chip: { bottom: 162, top: 140 },
      feedback: { bottom: 710, top: 600 },
      title: { bottom: 202, top: 174 },
      visible,
    });

    expect(delta).toBe(26);
  });

  it("stops at the top of a feedback taller than the screen", () => {
    const delta = getRevealDelta({
      chip: null,
      feedback: { bottom: 1600, top: 800 },
      title: { bottom: 144, top: 116 },
      visible,
    });

    expect(delta).toBe(684);
  });
});
