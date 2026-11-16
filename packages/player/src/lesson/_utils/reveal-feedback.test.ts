import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { getReveal } from "./reveal-feedback";

const visible = { bottom: 700, top: 100 };
const room = 2000;

describe(getReveal, () => {
  it("stays put when the feedback is already in sight", () => {
    const { delta } = getReveal({
      chip: null,
      feedback: { bottom: 600, top: 500 },
      room,
      title: { bottom: 144, top: 116 },
      visible,
    });

    expect(delta).toBe(0);
  });

  it("shows the whole feedback, and the title too when it has the room", () => {
    const { delta } = getReveal({
      chip: null,
      feedback: { bottom: 760, top: 660 },
      room,
      title: { bottom: 244, top: 216 },
      visible,
    });

    expect(delta).toBe(76);
  });

  it("lets the title scroll away when the whole feedback needs its room", () => {
    const { delta } = getReveal({
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

    const { delta } = getReveal({
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

    const { delta } = getReveal({
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
    const { delta } = getReveal({
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

    const { delta } = getReveal({
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

    const { delta } = getReveal({
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

    const { delta } = getReveal({ chip: null, feedback, room: 30, title, visible });

    expect(title.top - delta).toBeGreaterThanOrEqual(visible.top);
    expect(feedback.bottom - delta).toBeLessThanOrEqual(visible.bottom);
  });

  it("takes a title out whole with the room it lacks when keeping it would cut the feedback", () => {
    // A phone's compound interest screen: 58px to scroll, 70px to take the two-line question out.
    const area = { bottom: 767, top: 69 };
    const feedback = { bottom: 801, top: 689 };
    const title = { bottom: 139, top: 85 };

    const { delta, extraRoom } = getReveal({
      chip: null,
      feedback,
      room: 58,
      title,
      visible: area,
    });

    expect(title.bottom - delta).toBeLessThanOrEqual(area.top);
    expect(feedback.bottom - delta).toBeLessThanOrEqual(area.bottom);
    expect(feedback.top - delta).toBeGreaterThanOrEqual(area.top);
    expect(extraRoom).toBe(delta - 58);
  });

  it("asks for no room when the screen can already scroll the title out", () => {
    const { extraRoom } = getReveal({
      chip: null,
      feedback: { bottom: 740, top: 600 },
      room,
      title: { bottom: 172, top: 116 },
      visible,
    });

    expect(extraRoom).toBe(0);
  });

  it("stops at the top of a feedback taller than the screen", () => {
    const { delta } = getReveal({
      chip: null,
      feedback: { bottom: 1600, top: 800 },
      room,
      title: { bottom: 144, top: 116 },
      visible,
    });

    expect(delta).toBe(684);
  });
});

describe("whole canvas controls", () => {
  it("resolves overlapping protected parts as one interval", () => {
    const parts = [
      { bottom: 420, top: 300 },
      { bottom: 500, top: 400 },
    ];

    const reveal = getReveal({
      chip: null,
      feedback: { bottom: 750, top: 600 },
      parts,
      room: 300,
      title: null,
      visible,
    });

    for (const part of parts) {
      expect(
        part.top - reveal.delta >= visible.top || part.bottom - reveal.delta <= visible.top,
      ).toBe(true);
    }
  });

  it("keeps every protected part whole without cutting fitting feedback", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            height: fc.integer({ max: 100, min: 1 }),
            top: fc.integer({ max: 1100, min: 0 }),
          }),
          { maxLength: 30 },
        ),
        fc.integer({ max: 2000, min: 700 }),
        (items, availableRoom) => {
          const parts = items.map(({ top, height }) => ({ bottom: top + height, top }));
          const feedback = { bottom: 1400, top: 1200 };

          const { delta, extraRoom } = getReveal({
            chip: null,
            feedback,
            parts,
            room: availableRoom,
            title: null,
            visible,
          });

          const applied = Math.min(delta, availableRoom + extraRoom);

          expect(
            parts.every(
              (part) => part.top - applied >= visible.top || part.bottom - applied <= visible.top,
            ),
          ).toBe(true);

          expect(feedback.top - applied).toBeGreaterThanOrEqual(visible.top);
          expect(feedback.bottom - applied).toBeLessThanOrEqual(visible.bottom);
          expect(extraRoom).toBeGreaterThanOrEqual(0);
        },
      ),
    );
  });
});

describe("available scroll room", () => {
  it("provides the margin's missing room so clamping cannot recut an earlier control", () => {
    const part = { bottom: 803, top: 750 };

    const { delta, extraRoom } = getReveal({
      chip: null,
      feedback: { bottom: 1400, top: 1200 },
      parts: [part],
      room: 700,
      title: null,
      visible,
    });

    const applied = Math.min(delta, 700 + extraRoom);
    expect(part.top - applied >= visible.top || part.bottom - applied <= visible.top).toBe(true);
  });
});
