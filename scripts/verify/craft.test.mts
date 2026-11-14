/* oxlint-disable no-magic-numbers -- The fixtures are measurements in pixels. */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { centerLeads, edgeLeads } from "./craft-edges.mts";
import { type Control, type CraftPage, type Ink, type TextStyle } from "./craft-probe.mts";
import {
  craftFindings,
  iconLeads,
  roomLeads,
  shapeLeads,
  sizeLeads,
  spacingLeads,
  typeLeads,
} from "./craft.mts";

const LINE = 20;
const RADIUS = 10;
const TYPE_SCALE = [11.5, 12, 13, 14, 18];

function ink(label: string, left: number, top: number, overrides: Partial<Ink> = {}): Ink {
  return {
    bottom: top + LINE,
    context: -1,
    kind: "text",
    label,
    left,
    leftCounts: true,
    lines: 1,
    right: left + 80,
    rightCounts: false,
    top,
    ...overrides,
  };
}

/** A settings page on a phone: the column starts at 16 px and its rows end at 374 px. */
const column = [
  ink('"Settings"', 16, 100),
  ink('"Preferences"', 16, 160),
  ink('"Reminders"', 16, 200),
  ink('"Card"', 16, 240, { kind: "box", right: 374, rightCounts: true }),
];

/** The same page as the probe reports it: the title's "S" starts 1.6 px inside its box. */
const lettered = [ink('"Settings"', 16, 100, { inkLeft: 17.6 }), ...column.slice(1)];

const backArrow = ink('chevron-left icon in "Back"', 34.7, 30, {
  bare: true,
  kind: "icon",
  right: 41.3,
});

function control(label: string, overrides: Partial<Control> = {}): Control {
  return {
    bottom: 44,
    height: 44,
    kind: "button",
    label,
    left: 16,
    radius: RADIUS,
    right: 200,
    top: 0,
    width: 184,
    ...overrides,
  };
}

function shaped(controls: Control[]): Pick<CraftPage, "controls" | "radius"> {
  return { controls, radius: RADIUS };
}

function text(label: string, size: number, overrides: Partial<TextStyle> = {}): TextStyle {
  return { block: -1, inline: false, label, size, ...overrides };
}

/** Craft rule ids are shared across reports. */
function checks(findings: { check: string }[]) {
  return findings.map((finding) => finding.check.split(" ")[0]);
}

describe("edges", () => {
  it("leads to the back arrow 18.7 px right of the edge the title and the rows share", () => {
    const [arrow, ...rest] = edgeLeads([...column, backArrow]);

    assert.deepEqual(rest, []);
    assert.equal(arrow?.check, "E2 a bare glyph sits on the edge by its ink");
    assert.equal(arrow?.value, 18.7);

    assert.match(
      arrow?.message ?? "",
      /"Back" starts 18\.7 px right of the left edge 4 things share/u,
    );
  });

  it("stays quiet when the arrow starts within 1 px of the title's first letter", () => {
    assert.deepEqual(edgeLeads([...lettered, { ...backArrow, left: 17.7, right: 24 }]), []);
  });

  it("leads to an arrow on the box's edge, 1.6 px left of the letter under it", () => {
    const [arrow] = edgeLeads([...lettered, { ...backArrow, left: 16, right: 22.7 }]);

    assert.equal(arrow?.check, "E2 a bare glyph sits on the edge by its ink");
    assert.equal(arrow?.value, 1.6);
    assert.match(arrow?.message ?? "", /starts 1\.6 px left of the letters of "Settings"/u);
  });

  it("leads to any part of a glyph outside its column's edge", () => {
    const [arrow] = edgeLeads([...column, { ...backArrow, left: 15.7, right: 22.4 }]);

    assert.equal(arrow?.value, 0.3);
    assert.match(arrow?.message ?? "", /starts 0\.3 px outside the left edge of "Settings"/u);
  });

  it("leaves a row's leading mark to its axis, and leads to a trailing chevron short of the edge", () => {
    const mark = ink("list-checks icon", 19.3, 300, { kind: "icon", right: 32.7 });

    const chevron = ink("chevron-right icon", 358, 160, {
      kind: "icon",
      right: 368.7,
      rightCounts: true,
    });

    const end = [130, 200].map((top) =>
      ink('"Off"', 330, top, { left: 330, right: 374, rightCounts: true }),
    );

    assert.deepEqual(checks(edgeLeads([...column, mark, chevron, ...end])), ["E3"]);
  });

  it("leaves a hanging indent alone: a line under a label that follows a mark", () => {
    const row = [
      ink("check icon", 16, 300, { kind: "icon", right: 32 }),
      ink('"Daily reminder"', 44, 300),
      ink('"At 8:00 on study days"', 44, 322),
    ];

    assert.deepEqual(edgeLeads([...column, ...row]), []);
  });

  it("leaves a mark on the axis other marks are centered on, as a sidebar's avatar", () => {
    const icons = [130, 160, 190].map((top) => ink("icon", 20, top, { kind: "icon", right: 36 }));
    const avatar = ink('"P"', 16, 260, { kind: "box", right: 40 });

    assert.deepEqual(edgeLeads([...column, ...icons, avatar]), []);
  });

  it("measures a panel's contents against each other, not against the page", () => {
    const panel = ink('"Next belt"', 16, 400, { inner: 0, kind: "box", right: 374 });

    const inside = [
      ink('"Next belt"', 32, 416, { context: 0 }),
      ink('"Yellow"', 32, 440, { context: 0 }),
    ];

    assert.deepEqual(edgeLeads([...column, panel, ...inside]), []);
  });

  it("leaves a highlighted row reaching past the column, since its contents start on the edge", () => {
    const highlight = ink('"Today"', 6, 400, { inner: 0, kind: "box", right: 384 });

    assert.deepEqual(
      edgeLeads([...column, highlight, ink('"Today"', 16, 410, { context: 0 })]),
      [],
    );
  });

  it("leads to a ghost button's label that ends short of the right edge", () => {
    const logIn = ink('"Log in"', 318, 20, { right: 357, rightCounts: true });

    const cards = [300, 400].map((top) =>
      ink('"Course"', 16, top, { kind: "box", right: 374, rightCounts: true }),
    );

    const [lead] = edgeLeads([...column, ...cards, logIn]);

    assert.equal(checks([lead ?? { check: "" }])[0], "E3");
    assert.equal(lead?.value, 17);
  });

  it("doesn't take a column of icons' blank sides for an edge", () => {
    const chevrons = [300, 340, 380].map((top) =>
      ink("chevron-down icon", 361.3, top, { kind: "icon", right: 370.7, rightCounts: true }),
    );

    assert.deepEqual(
      edgeLeads([ink('"Terms"', 335, 500, { right: 373, rightCounts: true }), ...chevrons]),
      [],
    );
  });
});

describe("an icon beside its text", () => {
  it("leads when their middles are more than 1 px apart", () => {
    const words = ink('"Content gap"', 36, 100);

    assert.deepEqual(
      checks(centerLeads([words, ink("lightbulb icon", 16, 103, { kind: "icon", right: 30 })])),
      ["E5"],
    );

    assert.deepEqual(
      centerLeads([words, ink("lightbulb icon", 16, 101, { kind: "icon", right: 30 })]),
      [],
    );
  });
});

describe("shapes and sizes", () => {
  it("leads to a corner that isn't the system's, a pill and square corners among rounded ones", () => {
    assert.deepEqual(
      shapeLeads(shaped([control("Start"), control("Avatar", { radius: -1, width: 44 })])),
      [],
    );

    assert.deepEqual(
      checks(
        shapeLeads(
          shaped([
            control("Start"),
            control("Chip", { radius: -1 }),
            control("Panel", { kind: "panel", radius: 7 }),
            control("Square", { radius: 0 }),
          ]),
        ),
      ),
      ["H1", "H3", "H3"],
    );
  });

  it("leads to a height off the set and to two heights side by side", () => {
    assert.deepEqual(checks(sizeLeads([control("Search", { bottom: 32, height: 32 })])), ["Z1"]);

    const pair = [
      control("Save"),
      control("More", { bottom: 36, height: 36, left: 208, right: 244 }),
    ];

    assert.deepEqual(checks(sizeLeads(pair)), ["Z1"]);

    const apart = [
      control("Save"),
      control("More", { bottom: 36, height: 36, left: 300, right: 336 }),
    ];

    assert.deepEqual(sizeLeads(apart), []);
  });
});

function roomPanel(overrides: Partial<Ink>): Ink {
  return ink('"Ask Zu"', 16, 100, { bottom: 156, inner: 0, kind: "box", right: 374, ...overrides });
}

describe("a panel's room (S4)", () => {
  it("leads to a panel with less room above and below its content than beside it", () => {
    const [finding] = roomLeads([roomPanel({}), ink('"Explain this"', 32, 108, { context: 0 })]);
    assert.equal(finding?.value, 20);
  });

  it("stays quiet for even room, controls, a picture across a panel and a ragged end", () => {
    const held = ink('"Explain this"', 32, 116, { bottom: 140, context: 0 });
    assert.deepEqual(roomLeads([roomPanel({}), held]), []);

    assert.deepEqual(
      roomLeads([roomPanel({ control: true }), ink('"Go"', 32, 108, { context: 0 })]),
      [],
    );

    assert.deepEqual(
      roomLeads([roomPanel({}), ink("picture", 16, 100, { context: 0, kind: "picture" })]),
      [],
    );

    assert.deepEqual(
      roomLeads([roomPanel({ bottom: 130 }), ink('"x"', 32, 108, { context: 0 })]),
      [],
    );
  });
});

describe("spacing", () => {
  it("leads to unequal gaps and to a gap off the scale, not to packed or spread rows", () => {
    const group = { distributed: false, label: '"Features"' };

    assert.deepEqual(checks(spacingLeads([{ ...group, gaps: [12, 16] }])), ["S2"]);
    assert.deepEqual(checks(spacingLeads([{ ...group, gaps: [10, 10] }])), ["S1"]);
    assert.deepEqual(spacingLeads([{ ...group, gaps: [2, 2] }]), []);
    assert.deepEqual(spacingLeads([{ ...group, distributed: true, gaps: [47.3, 10] }]), []);
  });
});

describe("type", () => {
  it("leads to sizes off the roles and to a block with more than three sizes", () => {
    assert.deepEqual(checks(typeLeads([text('"Today"', 19)], TYPE_SCALE)), ["T1"]);
    assert.deepEqual(typeLeads([text('"Today"', 13)], TYPE_SCALE), []);

    const card = [18, 14, 12, 11.5].map((size) => text("line", size, { block: 0 }));
    assert.deepEqual(checks(typeLeads(card, TYPE_SCALE)), ["T1"]);

    const emphasis = [18, 14, 12].map((size) => text("line", size, { block: 0 }));
    const word = text('"2"', 13, { block: 0, inline: true });
    assert.deepEqual(typeLeads([...emphasis, word], TYPE_SCALE), []);
  });
});

describe("icons", () => {
  it("leads to sizes off the set and to a redrawn stroke, except on a thickened small glyph", () => {
    assert.deepEqual(
      checks(
        iconLeads([
          { label: "list-checks icon", size: 18, stroke: 2 },
          { label: "check icon", size: 16, stroke: 2.5 },
          { label: "fast-forward icon", size: 12, stroke: 3 },
          { label: "dot icon", size: 16, stroke: null },
        ]),
      ),
      ["I2", "I3"],
    );
  });
});

describe("a screen's leads", () => {
  it("lists a lead once however many times it shows", () => {
    const row = { distributed: false, gaps: [10, 10], label: "div" };

    const page: CraftPage = {
      controls: [],
      gaps: [row, row],
      icons: [],
      ink: [],
      radius: RADIUS,
      texts: [],
    };

    assert.equal(craftFindings(page, TYPE_SCALE).length, 1);
  });
});

describe("shared mark and corner sizes", () => {
  it("accepts 24 px marks and 6 px corners while rejecting outliers", () => {
    assert.deepEqual(iconLeads([{ label: "Notice", size: 24, stroke: 2 }]), []);
    assert.equal(iconLeads([{ label: "Notice", size: 25, stroke: 2 }]).length, 1);
    assert.deepEqual(shapeLeads(shaped([control("Chip", { radius: 6 })])), []);
    assert.equal(shapeLeads(shaped([control("Chip", { radius: 7 })])).length, 1);
  });
});
