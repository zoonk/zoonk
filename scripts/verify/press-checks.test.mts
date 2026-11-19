/* oxlint-disable no-magic-numbers -- The fixtures are layout in pixels. */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { type Press, pressFindings } from "./press-checks.mts";
import { type Region } from "./press-probe.mts";
import { type Action, type Moved, type Place } from "./states-probe.mts";

function at(top: number, overrides: Partial<Place> = {}): Place {
  return { height: 36, left: 16, top, width: 120, ...overrides };
}

function change(label: string, before: Place, after: Place, overrides: Partial<Moved> = {}): Moved {
  return {
    after,
    anchor: false,
    before,
    carried: false,
    drawn: false,
    holds: false,
    inside: false,
    isTarget: false,
    label,
    reworded: false,
    ...overrides,
  };
}

function region(label: string, top: number, overrides: Partial<Region> = {}): Region {
  return { floating: false, label, place: at(top, { height: 27 }), tied: false, ...overrides };
}

const CONTROL = at(100);

function press(
  kind: Action["kind"],
  {
    appeared = [],
    gone = [],
    moved = [],
    undone = [],
    scrollbar = [0, 0],
  }: {
    appeared?: Region[];
    gone?: Region[];
    moved?: Moved[];
    undone?: Moved[];
    scrollbar?: [number, number];
  } = {},
): Press {
  const role = kind === "pick" ? "radio" : "button";

  return {
    action: { id: "7", kind, label: 'label "Yearly"', name: "Yearly", role },
    doing: kind === "pick" ? "picking" : "opening",
    frames: {
      after: { scrollbar: scrollbar[1], sideways: 0 },
      before: { scrollbar: scrollbar[0], sideways: 0 },
    },
    pressed: { appeared, gone, moved, target: CONTROL },
    undone: { moved: undone, target: CONTROL },
  };
}

function checks(found: ReturnType<typeof pressFindings>) {
  return found.map((finding) => `${finding.level} ${finding.check}`);
}

describe("a press that swaps one content for another", () => {
  it("fails when the card holding a switch grows and pushes what follows (the pricing switch)", () => {
    const card = change('div "Plus"', at(40, { height: 400 }), at(40, { height: 427 }), {
      drawn: true,
      holds: true,
    });

    const footer = change('footer "Questions"', at(480), at(507));

    const found = pressFindings(
      press("pick", {
        appeared: [region('div "$96 per year"', 150)],
        gone: [region('div "$10 per month"', 150)],
        moved: [footer, card],
      }),
    );

    assert.deepEqual(checks(found), ["fail Press: the screen moved"]);
    assert.equal(found[0]?.value, 27);

    assert.equal(
      found[0]?.message,
      'picking radio "Yearly": it moved: div "Plus" went from 120×400 to 120×427 px; footer "Questions" moved 27 px down',
    );
  });

  it("passes when the card holds its height and only the shown price changes", () => {
    const found = pressFindings(
      press("pick", {
        appeared: [region('div "$96 per year"', 150)],
        gone: [region('div "$10 per month"', 150)],
      }),
    );

    assert.deepEqual(found, []);
  });
});

describe("a press that reveals a region of its own", () => {
  const below = change('div "Notes"', at(200), at(240));

  it("lets a switch tied to the field it shows push what follows down", () => {
    const found = pressFindings(
      press("pick", {
        appeared: [region('div "Weekend time"', 140, { tied: true })],
        moved: [below],
      }),
    );

    assert.deepEqual(found, []);
  });

  it("leads, without failing, when nothing ties the revealed field to its switch", () => {
    const found = pressFindings(
      press("pick", { appeared: [region('div "Weekend time"', 140)], moved: [below] }),
    );

    assert.deepEqual(checks(found), ["warn Press: reveal without aria-controls"]);
  });

  it("still fails when the reveal moves something beside the switch or the switch itself", () => {
    const beside = change('span "Weekdays"', at(100, { left: 200 }), at(100, { left: 208 }));

    const itself = change('label "Different time on weekends"', CONTROL, at(96), {
      isTarget: true,
    });

    const found = pressFindings(
      press("pick", {
        appeared: [region('div "Weekend time"', 140, { tied: true })],
        moved: [below, beside, itself],
      }),
    );

    assert.deepEqual(checks(found), [
      "fail Press: the control moved",
      "fail Press: the screen moved",
    ]);

    assert.match(found[1]?.message ?? "", /span "Weekdays" moved 8 px right$/u);
  });

  it("doesn't count a menu or tooltip that appeared as a reveal: it floats", () => {
    const found = pressFindings(
      press("pick", { appeared: [region('div "Tip"', 140, { floating: true })], moved: [below] }),
    );

    assert.deepEqual(checks(found), ["fail Press: the screen moved"]);
  });
});

describe("the pressed control and floating layers", () => {
  it("fails when opening a menu moves its own trigger (the lesson's … button)", () => {
    const trigger = change('button "Screen options"', at(8, { left: 340 }), at(8, { left: 330 }), {
      drawn: true,
      isTarget: true,
    });

    const found = pressFindings(press("overlay", { moved: [trigger] }));

    assert.deepEqual(checks(found), ["fail Press: the control moved"]);
    assert.equal(found[0]?.message, 'opening button "Yearly": it moved 10 px left');
  });

  it("fails when what a press opened pushes the page instead of floating over it", () => {
    const found = pressFindings(press("overlay", { moved: [change("main", at(200), at(260))] }));

    assert.match(
      found[0]?.message ?? "",
      /what it opened pushed the page instead of floating over it/u,
    );
  });

  it("leaves what went along with a parent that moved, and what's inside the control", () => {
    const parent = change("section", at(200), at(260));
    const child = change("p", at(210), at(270), { carried: true });
    const icon = change("svg", at(100, { left: 20 }), at(100, { left: 30 }), { inside: true });

    const found = pressFindings(press("overlay", { moved: [parent, child, icon] }));
    assert.match(found[0]?.message ?? "", /section moved 60 px down$/u);
  });
});

describe("words that change inside a control", () => {
  it("leaves a centered label whose words changed inside a button that kept its size", () => {
    const label = change(
      'span "Remove focus"',
      at(780, { left: 172, width: 46 }),
      at(780, { left: 146, width: 98 }),
    );

    assert.deepEqual(pressFindings(press("pick", { moved: [label] })), []);
  });

  it("leaves a button whose own label changed growing from the edge it's aligned to", () => {
    const button = change(
      'button "Remove focus"',
      at(860, { left: 562, width: 78 }),
      at(860, { left: 510, width: 130 }),
      { drawn: true, reworded: true },
    );

    assert.deepEqual(pressFindings(press("pick", { moved: [button] })), []);
  });

  it("still fails a button that changed size with the same label", () => {
    const button = change(
      'button "Save"',
      at(860, { left: 562, width: 78 }),
      at(860, { left: 510, width: 130 }),
      { drawn: true },
    );

    assert.deepEqual(checks(pressFindings(press("pick", { moved: [button] }))), [
      "fail Press: the screen moved",
    ]);
  });

  it("still fails a label that moved without changing", () => {
    const label = change(
      'span "Save"',
      at(780, { left: 172, width: 46 }),
      at(780, { left: 146, width: 46 }),
    );

    assert.deepEqual(checks(pressFindings(press("pick", { moved: [label] }))), [
      "fail Press: the screen moved",
    ]);
  });
});

describe("disclosures, tabs and panel toggles", () => {
  it("lets a disclosure push what's under it straight down, and its own list grow taller", () => {
    const list = change("ul", at(60, { height: 300 }), at(60, { height: 420 }), {
      drawn: true,
      holds: true,
    });

    const after = change('section "Later"', at(400), at(520));

    assert.deepEqual(pressFindings(press("fold", { moved: [list, after] })), []);
  });

  it('lets a list\'s last row, "2 more", go down by the rows it opened above itself', () => {
    const more = change('button "2 more"', at(500, { width: 358 }), at(619, { width: 358 }), {
      isTarget: true,
    });

    const card = change('div "Reserve Saturday"', at(540), at(659));
    const rows = region('li "Practice: series circuits"', 500, { place: at(500, { height: 119 }) });

    assert.deepEqual(pressFindings(press("fold", { appeared: [rows], moved: [more, card] })), []);
  });

  it("fails a disclosure that goes down when nothing opened above it", () => {
    const more = change('button "2 more"', at(500), at(619), { isTarget: true });
    const rows = region("ul", 540, { place: at(540, { height: 119 }) });

    assert.deepEqual(checks(pressFindings(press("fold", { appeared: [rows], moved: [more] }))), [
      "fail Press: the control moved",
    ]);
  });

  it("fails a disclosure that moves what's above or beside it", () => {
    const above = change('h1 "Today"', at(20), at(32));

    assert.deepEqual(checks(pressFindings(press("fold", { moved: [above] }))), [
      "fail Press: the screen moved",
    ]);
  });

  it("lets a panel toggle reflow the screen sideways, but not move itself", () => {
    const main = change(
      "main",
      at(0, { left: 260, width: 1180 }),
      at(0, { left: 60, width: 1380 }),
      { drawn: true },
    );

    const toggle = change('button "Sidebar"', at(8, { left: 220 }), at(8, { left: 20 }), {
      isTarget: true,
    });

    assert.deepEqual(pressFindings(press("panel", { moved: [main] })), []);

    assert.deepEqual(checks(pressFindings(press("panel", { moved: [main, toggle] }))), [
      "fail Press: the control moved",
    ]);
  });
});

describe("the page around a press, and undoing it", () => {
  it("fails when a press gives the page a scrollbar, narrowing everything", () => {
    const found = pressFindings(press("fold", { scrollbar: [0, 15] }));

    assert.deepEqual(checks(found), ["fail Press: the page's scroll changed"]);
    assert.equal(found[0]?.value, 15);
  });

  it("fails when undoing a press leaves something where it wasn't", () => {
    const found = pressFindings(
      press("fold", { undone: [change('section "Later"', at(400), at(424))] }),
    );

    assert.deepEqual(checks(found), ["fail Press: not back after undoing it"]);

    assert.match(
      found[0]?.message ?? "",
      /^undoing opening button "Yearly": section "Later" moved 24 px down$/u,
    );
  });
});

describe("an undo after a press that already failed", () => {
  it("reports the press once, not again as an undo that left it behind", () => {
    const row = change('button "Combine changes"', at(640), at(285), { isTarget: true });
    const found = pressFindings(press("fold", { moved: [row], undone: [row] }));

    assert.deepEqual(checks(found), ["fail Press: the control moved"]);
  });
});

describe("a press that takes its own control away", () => {
  it("doesn't judge the undo of a menu item that closed its menu", () => {
    const item = press("overlay", {
      undone: [change('button "Screen options"', at(8), at(8, { left: 28 }))],
    });

    item.pressed.target = null;

    assert.deepEqual(pressFindings(item), []);
  });
});
