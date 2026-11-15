import { describe, expect, it } from "vitest";
import { getRevealDelta } from "./reveal-feedback";

const visible = { bottom: 700, top: 100 };

describe(getRevealDelta, () => {
  it("stays put when the feedback is already in sight", () => {
    const delta = getRevealDelta({
      chip: null,
      feedback: { bottom: 600, top: 500 },
      titleTop: 116,
      verdict: { bottom: 530, top: 500 },
      visible,
    });

    expect(delta).toBe(0);
  });

  it("shows the whole feedback when the title stays on screen", () => {
    const delta = getRevealDelta({
      chip: null,
      feedback: { bottom: 760, top: 660 },
      titleTop: 216,
      verdict: { bottom: 690, top: 660 },
      visible,
    });

    expect(delta).toBe(76);
  });

  it("stops at the title when the whole feedback would scroll it away and the verdict still shows", () => {
    const delta = getRevealDelta({
      chip: null,
      feedback: { bottom: 900, top: 700 },
      titleTop: 156,
      verdict: { bottom: 730, top: 700 },
      visible,
    });

    expect(delta).toBe(40);
  });

  it("scrolls a chip over the title out whole when stopping at the title, leaving no sliver", () => {
    const chip = { bottom: 138, top: 116 };

    const delta = getRevealDelta({
      chip,
      feedback: { bottom: 900, top: 700 },
      titleTop: 150,
      verdict: { bottom: 730, top: 700 },
      visible,
    });

    expect(delta).toBe(38);
    expect(chip.bottom - delta).toBeLessThanOrEqual(visible.top);
  });

  it("goes on to the title when showing the feedback would cut the chip over it", () => {
    const delta = getRevealDelta({
      chip: { bottom: 138, top: 116 },
      feedback: { bottom: 714, top: 600 },
      titleTop: 150,
      verdict: { bottom: 630, top: 600 },
      visible,
    });

    expect(delta).toBe(38);
  });

  it("keeps a chip that stays whole", () => {
    const delta = getRevealDelta({
      chip: { bottom: 162, top: 140 },
      feedback: { bottom: 710, top: 600 },
      titleTop: 174,
      verdict: { bottom: 630, top: 600 },
      visible,
    });

    expect(delta).toBe(26);
  });

  it("shows the whole feedback on a screen too tall to keep its title and its verdict together", () => {
    const delta = getRevealDelta({
      chip: null,
      feedback: { bottom: 1300, top: 1200 },
      titleTop: 116,
      verdict: { bottom: 1230, top: 1200 },
      visible,
    });

    expect(delta).toBe(616);
  });

  it("keeps the top of a feedback taller than the screen", () => {
    const delta = getRevealDelta({
      chip: null,
      feedback: { bottom: 1600, top: 800 },
      titleTop: null,
      verdict: null,
      visible,
    });

    expect(delta).toBe(684);
  });
});
