import { type Finding } from "./checks.mts";
import { type Frame, type Region, type Regions, type TextLine } from "./press-probe.mts";
import { changeOf, changeSize, describeChange } from "./states-checks.mts";
import { type Action, type Comparison, type Moved } from "./states-probe.mts";

/** Less is rounding: a press that moves something by a pixel isn't seen. */
const MIN_PX = 2;
/** Two lines of text cross by more than this each way before they read as drawn on top of each other. */
const OVERLAP_PX = 2;
const LISTED = 3;

/**
 * One press of a control the walk can press without leaving the page or sending anything: what it
 * did to the screen (`pressed`, against the screen before it) and whether undoing it (pressing
 * again, Esc, picking the old choice) put everything back (`undone`, against the same screen;
 * null when the walk couldn't undo it).
 */
export type Press = {
  action: Action;
  doing: string;
  frames: { after: Frame; before: Frame };
  pressed: Comparison & Regions;
  undone: Comparison | null;
};

function inFlow(regions: Region[]) {
  return regions.filter((region) => !region.floating);
}

function bottomOf(place: { height: number; top: number }) {
  return place.top + place.height;
}

/**
 * A disclosure (`aria-expanded`, a tab) may push what's under it down: that's what it's for. So may
 * a switch, checkbox or radio that reveals or hides a region of its own under it, like "Different
 * time on weekends" showing the weekend's time below it. A control that swaps one content for
 * another (a price for another price) must hold its height, so it pushes nothing.
 */
function revealOf(press: Press): { regions: Region[]; tied: boolean } | null {
  const { action, pressed } = press;
  const appeared = inFlow(pressed.appeared);
  const gone = inFlow(pressed.gone);
  const target = pressed.moved.find((change) => change.isTarget)?.before ?? pressed.target;

  if (action.kind !== "pick" || target === null || appeared.length > 0 === gone.length > 0) {
    return null;
  }

  const regions = [...appeared, ...gone];

  if (!regions.every((region) => region.place.top >= bottomOf(target) - 1)) {
    return null;
  }

  return { regions, tied: regions.some((region) => region.tied) };
}

/**
 * A "2 more" at a list's end opens its rows where it stood, so it goes straight down by what
 * opened above it, keeping its size: that is the disclosure working, not the control jumping.
 */
function opensAbove({ pressed }: Press, control: Moved) {
  const { across, down } = changeOf(control);

  const above = inFlow(pressed.appeared).filter(
    (region) =>
      region.place.top >= control.before.top - 1 && bottomOf(region.place) <= control.after.top + 1,
  );

  return (
    across === 0 &&
    down > 0 &&
    resizeOf(control) < MIN_PX &&
    above.length > 0 &&
    Math.abs(Math.max(...above.map((region) => bottomOf(region.place))) - control.after.top) <=
      MIN_PX
  );
}

/** On one axis, a box that changed size but kept its start, middle or end where it was. */
function heldAnchor(start: number, size: number, newStart: number, newSize: number) {
  const ends = [
    [start, newStart],
    [start + size / 2, newStart + newSize / 2],
    [start + size, newStart + newSize],
  ];

  return (
    Math.abs(newStart - start) < MIN_PX ||
    (newSize !== size && ends.some(([was, now = 0]) => Math.abs(now - (was ?? 0)) < MIN_PX))
  );
}

/**
 * A text whose own words changed ("Save" becoming "Remove focus") moves its box only around its own
 * anchor: its start, middle or end held. That's the words changing, not the screen jumping. A
 * button whose own label changed may grow or shrink the same way; any other box around it that
 * changes size is judged on its own.
 */
function rewords({ after, before }: Moved) {
  return (
    heldAnchor(before.left, before.width, after.left, after.width) &&
    heldAnchor(before.top, before.height, after.top, after.height)
  );
}

function shiftOf(change: Moved) {
  const { across, down } = changeOf(change);
  return Math.max(Math.abs(across), Math.abs(down));
}

function resizeOf(change: Moved) {
  const { taller, wider } = changeOf(change);
  return Math.max(Math.abs(taller), Math.abs(wider));
}

/**
 * What a press moved that it shouldn't have: the pressed control itself; anything before it or
 * beside it; anything after it, unless the control opens a region in the flow (a disclosure, a
 * tab, a reveal) and it only went straight down; and a drawn box (a card, a panel, a control) that
 * changed size, unless that region is what grew. A panel toggle folds a column away, so only the
 * toggle itself must stay. What went along with a parent that moved counts once, as its parent.
 */
export function pressMoves(press: Press): Moved[] {
  const { action, pressed } = press;
  const target = pressed.moved.find((change) => change.isTarget)?.before ?? pressed.target;
  const pushes = action.kind === "fold" || revealOf(press) !== null;

  return pressed.moved.filter((change) => {
    if (change.inside) {
      return false;
    }

    if (change.isTarget) {
      return (
        (shiftOf(change) >= MIN_PX || resizeOf(change) >= MIN_PX) &&
        !(pushes && opensAbove(press, change))
      );
    }

    if (action.kind === "panel" || target === null) {
      return false;
    }

    const { across, wider } = changeOf(change);
    const below = change.before.top >= bottomOf(target) - 1;

    if (shiftOf(change) >= MIN_PX && !change.carried && !rewords(change)) {
      return !(pushes && below && across === 0);
    }

    if (resizeOf(change) >= MIN_PX && change.drawn && !(change.reworded && rewords(change))) {
      return !(pushes && wider === 0 && (change.holds || below));
    }

    return false;
  });
}

/** What an undo left out of place: something that moved on its own, or a drawn box that kept a new size. */
export function restoreMoves(undone: Comparison): Moved[] {
  return undone.moved.filter(
    (change) =>
      !change.inside &&
      ((shiftOf(change) >= MIN_PX && (!change.carried || change.isTarget)) ||
        (resizeOf(change) >= MIN_PX && change.drawn)),
  );
}

function listed(changes: Moved[]) {
  const named = changes.slice(0, LISTED).map((change) => describeChange(change));
  const more = changes.length > LISTED ? ` and ${changes.length - LISTED} more` : "";
  return `${named.join("; ")}${more}`;
}

function largest(changes: Moved[]) {
  return Math.max(...changes.map((change) => changeSize(changeOf(change))));
}

export function controlName(action: Action) {
  return `${action.role} "${action.name}"`;
}

/** Every fault of one press, each a failing finding, and a reveal no `aria-controls` ties to its control as a lead. */
export function pressFindings(press: Press): Finding[] {
  const { action, doing, frames, undone } = press;
  const control = controlName(action);
  const findings: Finding[] = [];
  const moves = pressMoves(press);
  const itself = moves.find((change) => change.isTarget);
  const others = moves.filter((change) => !change.isTarget);

  if (itself) {
    findings.push({
      check: "Press: the control moved",
      level: "fail",
      message: `${doing} ${control}: it ${describeChange(itself).replace(itself.label, "").trim()}`,
      unit: "px",
      value: largest([itself]),
    });
  }

  if (others.length > 0) {
    const what =
      action.kind === "overlay"
        ? "what it opened pushed the page instead of floating over it"
        : "it moved";

    findings.push({
      check: "Press: the screen moved",
      level: "fail",
      message: `${doing} ${control}: ${what}: ${listed(others)}`,
      unit: "px",
      value: largest(others),
    });
  }

  if (frames.after.scrollbar > frames.before.scrollbar) {
    findings.push({
      check: "Press: the page's scroll changed",
      level: "fail",
      message: `${doing} ${control}: the page gained a scrollbar, so everything narrowed by its width`,
      unit: "px",
      value: frames.after.scrollbar - frames.before.scrollbar,
    });
  }

  if (frames.after.sideways > Math.max(frames.before.sideways, 1)) {
    findings.push({
      check: "Press: the page's scroll changed",
      level: "fail",
      message: `${doing} ${control}: the page now scrolls sideways`,
      unit: "px",
      value: frames.after.sideways,
    });
  }

  // A press that took its own control away (a menu item closing its menu) can't be put back by
  // pressing it again, and a press that already failed leaves its fault behind (an accordion that
  // closed another section), so only an undo after a clean press is judged.
  const clean = !findings.some((finding) => finding.level === "fail");
  const left = undone && clean && press.pressed.target !== null ? restoreMoves(undone) : [];

  if (left.length > 0) {
    findings.push({
      check: "Press: not back after undoing it",
      level: "fail",
      message: `undoing ${doing} ${control}: ${listed(left)}`,
      unit: "px",
      value: largest(left),
    });
  }

  const reveal = revealOf(press);

  if (reveal && !reveal.tied && moves.length === 0) {
    findings.push({
      check: "Press: reveal without aria-controls",
      level: "warn",
      message: `${doing} ${control} shows or hides ${reveal.regions[0]?.label ?? "a region"} under it and pushes what follows, but doesn't name it in aria-controls (with aria-expanded), so it's read as a reveal by its place alone`,
    });
  }

  return findings;
}

/** Two texts drawn on top of each other: their elements (for marking), names, and how much of them overlaps. */
export type Overlap = {
  a: string;
  b: string;
  elements: [number, number];
  height: number;
  width: number;
};

/**
 * Text drawn over other text: two lines from different elements, neither inside the other, that
 * cross by more than `OVERLAP_PX` each way. A menu, dialog, popover or tooltip floats over the page
 * by design, and a pinned bar over what scrolls under it, so a pair counts only in one layer: both
 * in the page's flow, both in the same floating layer, or in two pinned boxes (two panels drawn
 * over each other). Each pair of elements is reported once, by its largest overlap.
 */
export function findOverlaps(lines: TextLine[]): Overlap[] {
  const sorted = lines.toSorted((first, second) => first.top - second.top);
  const found = new Map<string, Overlap>();

  function record(
    first: TextLine,
    second: TextLine,
    { height, width }: { height: number; width: number },
  ) {
    const [a, b] = first.element < second.element ? [first, second] : [second, first];
    const key = `${a.element} ${b.element}`;
    const seen = found.get(key);

    if (!seen || seen.width * seen.height < width * height) {
      found.set(key, {
        a: a.name,
        b: b.name,
        elements: [a.element, b.element],
        height: Math.round(height),
        width: Math.round(width),
      });
    }
  }

  for (const [index, first] of sorted.entries()) {
    for (const second of sorted.slice(index + 1)) {
      if (second.top >= first.bottom - OVERLAP_PX) {
        break;
      }

      const pinnedPair =
        !first.overlay && !second.overlay && first.layer !== null && second.layer !== null;

      const width = Math.min(first.right, second.right) - Math.max(first.left, second.left);
      const height = Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top);

      const crosses =
        (first.layer === second.layer || pinnedPair) &&
        width > OVERLAP_PX &&
        height > OVERLAP_PX &&
        first.element !== second.element &&
        !first.within.includes(second.element) &&
        !second.within.includes(first.element);

      if (crosses) {
        record(first, second, { height, width });
      }
    }
  }

  return [...found.values()];
}

/** Text drawn over other text on one state of the screen: at rest, or after a press. */
export function overlapFindings(overlaps: Overlap[], state: string): Finding[] {
  return overlaps.map((overlap) => ({
    check: "Press: text over text",
    level: "fail",
    message: `${state}: ${overlap.a} and ${overlap.b} are drawn over each other (${overlap.width}×${overlap.height} px)`,
    unit: "px",
    value: Math.min(overlap.width, overlap.height),
  }));
}
