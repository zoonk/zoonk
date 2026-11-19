/* oxlint-disable max-lines-per-function, max-statements, unicorn/consistent-function-scoping -- Each function is sent to the page on its own, so its helpers live inside it (`probe.mts`). */

/**
 * One line of visible text, in viewport pixels, cut to its line height (so tight leading doesn't
 * reach the next line) and to the boxes that clip it, as the browser clips it. `element` is its
 * element's place in `zoonkTextElements` and `within` its ancestors' there; `layer` is the floating
 * layer it's drawn in, if any: an `overlay` (a menu, dialog, popover or tooltip) or a pinned (fixed
 * or sticky) box.
 */
export type TextLine = {
  bottom: number;
  element: number;
  layer: number | null;
  left: number;
  name: string;
  overlay: boolean;
  right: number;
  top: number;
  within: number[];
};

/**
 * Something on screen that showed up or went away, outermost first: what a press revealed, hid or
 * swapped. `tied` when the control names it in `aria-controls`; `floating` when it is laid out
 * outside the control's flow (in a fixed, absolute or sticky box that doesn't hold the control),
 * like a menu or a tooltip, so it pushes nothing. A field revealed inside a sheet is in the sheet's
 * flow, beside the switch that revealed it.
 */
export type Region = {
  floating: boolean;
  label: string;
  place: { height: number; left: number; top: number; width: number };
  tied: boolean;
};

export type Regions = { appeared: Region[]; gone: Region[] };

declare global {
  // oxlint-disable-next-line no-var -- A page global is declared with `var`.
  var zoonkTextElements: Element[] | undefined;
}

/**
 * What a press can do to the page itself: `scrollbar` is the room a classic scrollbar takes (0
 * where it overlays, as on phones), `sideways` how far the page scrolls sideways.
 */
export function readFrame() {
  const root = document.documentElement;

  return {
    scrollbar: innerWidth - root.clientWidth,
    sideways: root.scrollWidth - root.clientWidth,
  };
}

export type Frame = ReturnType<typeof readFrame>;

/** Marks what the last comparison found moved, by its place in `moved`, so pictures before and after can outline it. */
export function markMoved(indexes: number[]) {
  for (const index of indexes) {
    const element = globalThis.zoonkMoved?.[index];

    if (element) {
      element.dataset.zoonkMoved = "";
    }
  }
}

/**
 * Outlines the marked elements (red) and the pressed control (blue dashed) for a picture, without
 * moving anything, or takes the outlines away; `clear` also drops the marks.
 */
export function showMarks({
  clear = false,
  on,
  targetId,
}: {
  clear?: boolean;
  on: boolean;
  targetId: string;
}) {
  document.querySelector("#zoonk-press-marks")?.remove();

  if (clear) {
    for (const element of document.querySelectorAll<HTMLElement>(
      "[data-zoonk-moved], [data-zoonk-overlap]",
    )) {
      delete element.dataset.zoonkMoved;
      delete element.dataset.zoonkOverlap;
    }
  }

  if (!on) {
    return;
  }

  const style = document.createElement("style");
  style.id = "zoonk-press-marks";
  style.textContent = `[data-zoonk-moved],[data-zoonk-overlap]{outline:2px solid #e5004c !important;outline-offset:-1px !important}[data-zoonk-act="${CSS.escape(targetId)}"]{outline:2px dashed #0a6cff !important;outline-offset:2px !important}`;
  document.head.append(style);
}

export function readTextLines(): TextLine[] {
  const NAME_LENGTH = 40;
  const SMALLEST = 1;
  const LEADING = 1.2;

  const OVERLAYS =
    "[role=menu], [role=dialog], [role=alertdialog], [role=listbox], [role=tooltip], [popover], [data-slot$=popup]";

  const CLIPS = new Set(["auto", "clip", "hidden", "scroll"]);
  const { label, pixels, shown } = globalThis.zoonkPage;

  type Box = { bottom: number; left: number; right: number; top: number };

  const elements: Element[] = [];
  const indexes = new Map<Element, number>();

  function indexOf(element: Element) {
    const known = indexes.get(element);

    if (known !== undefined) {
      return known;
    }

    indexes.set(element, elements.length);
    elements.push(element);
    return elements.length - 1;
  }

  function layerOf(element: Element): { layer: Element | null; overlay: boolean } {
    const overlay = element.closest(OVERLAYS);

    if (overlay) {
      return { layer: overlay, overlay: true };
    }

    for (let current: Element | null = element; current; current = current.parentElement) {
      const { position } = getComputedStyle(current);

      if (position === "fixed" || position === "sticky") {
        return { layer: current, overlay: false };
      }
    }

    return { layer: null, overlay: false };
  }

  /**
   * The boxes that clip what it draws: its own and its ancestors' `overflow`, except where it
   * escapes them, as a positioned box does: an absolute one is clipped only from its containing
   * block up (its nearest positioned or transformed ancestor), and a fixed one by none of them.
   */
  function clipOf(element: Element): Box {
    const box: Box = { bottom: Infinity, left: -Infinity, right: Infinity, top: -Infinity };
    let escaping: "absolute" | "fixed" | null = null;

    for (let current: Element | null = element; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      const containing = style.position !== "static" || style.transform !== "none";

      if (current !== element && escaping === "absolute" && containing) {
        escaping = null;
      }

      if (escaping === null) {
        const rect = current.getBoundingClientRect();

        if (CLIPS.has(style.overflowX)) {
          box.left = Math.max(box.left, rect.left);
          box.right = Math.min(box.right, rect.right);
        }

        if (CLIPS.has(style.overflowY)) {
          box.top = Math.max(box.top, rect.top);
          box.bottom = Math.min(box.bottom, rect.bottom);
        }
      }

      if (style.position === "fixed") {
        escaping = "fixed";
      } else if (style.position === "absolute" && escaping === null) {
        escaping = "absolute";
      }
    }

    return box;
  }

  const lines: TextLine[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

  const nodes: Node[] = [];

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    nodes.push(node);
  }

  const drawn = nodes.filter(
    (node) =>
      node.parentElement &&
      node.textContent?.trim() &&
      !node.parentElement.closest("script, style, noscript") &&
      shown(node.parentElement),
  );

  for (const node of drawn) {
    const element = node.parentElement ?? document.body;

    const style = getComputedStyle(element);

    const lineHeight = pixels(style.lineHeight) || pixels(style.fontSize) * LEADING;

    const clip = clipOf(element);
    const range = document.createRange();
    range.selectNodeContents(node);
    const { layer, overlay } = layerOf(element);
    const within: number[] = [];

    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      within.push(indexOf(parent));
    }

    const name = `${element.tagName.toLowerCase()} "${(label(element, true) || (node.textContent ?? "").trim()).slice(0, NAME_LENGTH)}"`;

    for (const rect of range.getClientRects()) {
      const inset = Math.max(0, (rect.height - lineHeight) / 2);

      const box = {
        bottom: Math.min(rect.bottom - inset, clip.bottom),
        left: Math.max(rect.left, clip.left),
        right: Math.min(rect.right, clip.right),
        top: Math.max(rect.top + inset, clip.top),
      };

      if (box.right - box.left > SMALLEST && box.bottom - box.top > SMALLEST) {
        lines.push({
          ...box,
          element: indexOf(element),
          layer: layer ? indexOf(layer) : null,
          name,
          overlay,
          within,
        });
      }
    }
  }

  globalThis.zoonkTextElements = elements;
  return lines;
}

/** Marks the texts of each overlap (`data-zoonk-overlap`) for a picture, and brings the first into view. */
export function markOverlaps(indexes: number[]) {
  const elements = indexes.flatMap((index) => globalThis.zoonkTextElements?.[index] ?? []);

  for (const element of elements) {
    if (element instanceof HTMLElement) {
      element.dataset.zoonkOverlap = "";
    }
  }

  const [first] = elements;
  const box = first?.getBoundingClientRect();

  if (first && box && (box.bottom < 0 || box.top > innerHeight)) {
    first.scrollIntoView({ block: "center" });
  }
}

/**
 * What showed up and what went away since the snapshot `from` (`snapshotLayout`), outermost only,
 * since what's inside a region that came or went came or went with it. `controls` is the pressed
 * control's `aria-controls`.
 */
export function readRegions({
  controls = "",
  from,
  targetId,
}: {
  controls?: string;
  from: string;
  targetId: string;
}): Regions {
  const LABEL_LENGTH = 40;
  const { label, place } = globalThis.zoonkPage;
  const target = document.querySelector(`[data-zoonk-act="${targetId}"]`);
  const before = globalThis.zoonkLayout?.[from] ?? [];
  const known = new Set(before.map(({ element }) => element));
  const ids = controls.split(/\s+/u).filter(Boolean);

  function shownNow(element: HTMLElement) {
    return (
      element.isConnected &&
      element.offsetWidth > 0 &&
      element.offsetHeight > 0 &&
      element.checkVisibility({ visibilityProperty: true })
    );
  }

  function tied(element: HTMLElement) {
    return ids.some((id) => {
      const controlled = document.querySelector(`#${CSS.escape(id)}`);

      return (
        element.id === id ||
        element.querySelector(`#${CSS.escape(id)}`) !== null ||
        (controlled !== null && (controlled.contains(element) || element.contains(controlled)))
      );
    });
  }

  function apart(layer: HTMLElement | null) {
    return layer !== null && !(target && layer.contains(target));
  }

  function floats(element: HTMLElement) {
    for (
      let current: HTMLElement | null = element;
      current && current !== document.body;
      current = current.parentElement
    ) {
      if (["fixed", "absolute", "sticky"].includes(getComputedStyle(current).position)) {
        return apart(current);
      }
    }

    return false;
  }

  function outermost(list: HTMLElement[]) {
    const set = new Set(list);
    return list.filter((element) => !element.parentElement || !set.has(element.parentElement));
  }

  function name(element: HTMLElement) {
    const text = label(element).slice(0, LABEL_LENGTH);
    return `${element.tagName.toLowerCase()}${text ? ` "${text}"` : ""}`;
  }

  const left = new Set(
    outermost(before.filter(({ element }) => !shownNow(element)).map(({ element }) => element)),
  );

  const gone = before
    .filter(({ element }) => left.has(element))
    .map(({ element, layer, place: was }) => ({
      floating: apart(layer),
      label: name(element),
      place: was,
      tied: tied(element),
    }));

  const added = [...document.body.querySelectorAll<HTMLElement>("*")].filter(
    (element) => !known.has(element) && shownNow(element),
  );

  const appeared = outermost(added).map((element) => ({
    floating: floats(element),
    label: name(element),
    place: place(element),
    tied: tied(element),
  }));

  return { appeared, gone };
}
