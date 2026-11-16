import { describe, expect, it } from "vitest";
import { getRevealDelta } from "./reveal-feedback";

const visible = { bottom: 700, top: 100 };
const room = 2000;

describe(getRevealDelta, () => {
  it("stays put when the feedback is already in sight", () => {
    const delta = getRevealDelta({
      chip: null,
      feedback: { bottom: 600, top: 500 },
      room,
      title: { bottom: 144, top: 116 },
      visible,
    });

    expect(delta).toBe(0);
  });

  it("shows the whole feedback, and the title too when it has the room", () => {
    const delta = getRevealDelta({
      chip: null,
      feedback: { bottom: 760, top: 660 },
      room,
      title: { bottom: 244, top: 216 },
      visible,
    });

    expect(delta).toBe(76);
  });

  it("lets the title scroll away when the whole feedback needs its room", () => {
    const delta = getRevealDelta({
      chip: null,
      feedback: { bottom: 900, top: 700 },
      room,
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
      room,
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
      room,
      title: { bottom: 178, top: 150 },
      visible,
    });

    expect(delta).toBe(40);
    expect(chip.bottom - delta).toBeLessThan(visible.top);
  });

  it("keeps a chip that stays whole", () => {
    const delta = getRevealDelta({
      chip: { bottom: 162, top: 140 },
      feedback: { bottom: 710, top: 600 },
      room,
      title: { bottom: 202, top: 174 },
      visible,
    });

    expect(delta).toBe(26);
  });

  it("gives up the margin over a feedback that only fits without it, never its bottom", () => {
    const feedback = { bottom: 1390, top: 800 };

    const delta = getRevealDelta({
      chip: null,
      feedback,
      room,
      title: { bottom: 144, top: 116 },
      visible,
    });

    expect(feedback.bottom - delta).toBeLessThanOrEqual(visible.bottom);
    expect(feedback.top - delta).toBeGreaterThanOrEqual(visible.top);
  });

  it("keeps a title whole when the scroll only takes the chip over it", () => {
    const chip = { bottom: 107, top: 85 };
    const title = { bottom: 146, top: 119 };
    const area = { bottom: 767, top: 69 };

    const delta = getRevealDelta({
      chip,
      feedback: { bottom: 799, top: 688 },
      room: 56,
      title,
      visible: area,
    });

    expect(delta).toBe(48);
    expect(chip.bottom - delta).toBeLessThan(area.top);
    expect(title.top - delta).toBeGreaterThanOrEqual(area.top);
  });

  it("keeps a title whole when the screen can't scroll it out and the feedback still shows whole", () => {
    const feedback = { bottom: 710, top: 600 };
    const title = { bottom: 172, top: 116 };

    const delta = getRevealDelta({ chip: null, feedback, room: 30, title, visible });

    expect(title.top - delta).toBeGreaterThanOrEqual(visible.top);
    expect(feedback.bottom - delta).toBeLessThanOrEqual(visible.bottom);
  });

  it("stops at the top of a feedback taller than the screen", () => {
    const delta = getRevealDelta({
      chip: null,
      feedback: { bottom: 1600, top: 800 },
      room,
      title: { bottom: 144, top: 116 },
      visible,
    });

    expect(delta).toBe(684);
  });
});
