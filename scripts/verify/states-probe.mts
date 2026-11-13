/* oxlint-disable max-lines-per-function, max-statements, unicorn/consistent-function-scoping -- Each function is sent to the page on its own, so its helpers live inside it (`probe.mts`). */

/** Where an element sits in the layout and how big it is, in CSS pixels, transforms left out. */
export type Place = { height: number; left: number; top: number; width: number };

/** An element that moved or changed size between two snapshots of the same page. */
export type Moved = {
  after: Place;
  before: Place;
  /** Its parent moved by the same amount, so it only went along. */
  carried: boolean;
  /** It contains what was acted on, as a form holds its field. */
  holds: boolean;
  /** A control, panel or picture: its own size is part of the screen. */
  drawn: boolean;
  isTarget: boolean;
  label: string;
};

/** A search field is a field whose list below it changes as a person types. */
export type ActionKind = "control" | "field" | "fold" | "overlay" | "pick" | "search";

export type Action = { id: string; kind: ActionKind; label: string };

declare global {
  // oxlint-disable-next-line no-var -- A page global is declared with `var`.
  var zoonkLayout: { element: HTMLElement; place: Place }[] | undefined;
}

/**
 * Marks what a person can try on the page without submitting anything (`data-zoonk-act`), inside
 * `scope` (the page, or an overlay that just opened), and returns it in document order: fields,
 * choices, folds and overlays, then every other control to hover and press.
 */
export function markActions(scope: string): Action[] {
  const LABEL_LENGTH = 40;
  const SMALLEST = 4;
  const FIELD = `input:not([type=hidden], [type=checkbox], [type=radio], [type=submit], [type=button], [type=reset], [type=file], [type=image], [type=range], [type=color]), textarea, [contenteditable=true]`;
  const PICK = `[role=checkbox], [role=radio], [role=switch], [role=option], [aria-pressed], input[type=checkbox], input[type=radio]`;
  const TOGGLE = `[aria-expanded]:not(a[href]), [aria-haspopup]:not(a[href]), summary, [role=tab]:not(a[href])`;
  const CONTROL = `button, a[href], [role=button], label`;
  const SEARCH = `[role=combobox], [role=searchbox], [type=search]`;

  const root =
    [...document.querySelectorAll(scope)].find((element) => element.checkVisibility()) ??
    document.body;

  const taken = new Set<Element>();
  const actions: Action[] = [];

  function usable(element: Element) {
    const box = element.getBoundingClientRect();

    return (
      box.width > SMALLEST &&
      box.height > SMALLEST &&
      !element.closest("[inert], [aria-hidden=true], [data-zoonk-act]") &&
      !element.querySelector("[data-zoonk-act]") &&
      !element.matches(":disabled, [aria-disabled=true], [readonly]") &&
      element.checkVisibility({ opacityProperty: true, visibilityProperty: true })
    );
  }

  function label(element: Element) {
    const labelledById = element.getAttribute("aria-labelledby")?.split(" ")[0];
    const labelledBy = labelledById ? document.querySelector(`#${CSS.escape(labelledById)}`) : null;

    const named =
      element.getAttribute("aria-label") ??
      // oxlint-disable-next-line unicorn/prefer-dom-node-text-content -- Only `innerText` leaves out hidden text.
      (labelledBy instanceof HTMLElement ? labelledBy.innerText : null) ??
      // oxlint-disable-next-line unicorn/prefer-dom-node-text-content -- Only `innerText` leaves out hidden text.
      (element instanceof HTMLElement ? element.innerText : "");

    const text = (named.trim() || element.getAttribute("placeholder") || element.id)
      .replaceAll(/\s+/gu, " ")
      .slice(0, LABEL_LENGTH);

    return `${element.tagName.toLowerCase()}${text ? ` "${text}"` : ""}`;
  }

  function kindOf(element: Element): ActionKind {
    if (element.matches(FIELD)) {
      return element.matches(SEARCH) ? "search" : "field";
    }

    if (element.matches(PICK)) {
      return "pick";
    }

    if (element.matches(TOGGLE)) {
      const popup = element.getAttribute("aria-haspopup");
      return popup && popup !== "false" ? "overlay" : "fold";
    }

    return "control";
  }

  for (const selector of [FIELD, PICK, TOGGLE, CONTROL]) {
    for (const found of root.querySelectorAll(selector)) {
      // A native checkbox is often drawn by its label.
      const element = found.matches("input[type=checkbox], input[type=radio]")
        ? (found.closest("label") ?? found)
        : found;

      if (!taken.has(element) && usable(element)) {
        taken.add(element);
        const id = String(document.querySelectorAll("[data-zoonk-act]").length);

        if (element instanceof HTMLElement || element instanceof SVGElement) {
          element.dataset.zoonkAct = id;
        }

        actions.push({ id, kind: kindOf(found), label: label(element) });
      }
    }
  }

  return actions;
}

/**
 * Remembers where every element on screen sits, for `compareLayout`. Positions come from
 * `offsetLeft`/`offsetTop`, which leave out transforms (a pressed button's scale, a sheet sliding
 * in) and scrolling, so only what the layout moved counts. A sticky bar's offset follows the
 * scroll, which acting on the page changes, so it and what's in it are left out.
 */
export function snapshotLayout() {
  function place(element: HTMLElement) {
    let left = 0;
    let top = 0;

    for (
      let current: HTMLElement | null = element;
      current;
      current = current.offsetParent instanceof HTMLElement ? current.offsetParent : null
    ) {
      left += current.offsetLeft;
      top += current.offsetTop;
    }

    return { height: element.offsetHeight, left, top, width: element.offsetWidth };
  }

  const sticky = [...document.body.querySelectorAll("*")].filter(
    (element) => getComputedStyle(element).position === "sticky",
  );

  globalThis.zoonkLayout = [...document.body.querySelectorAll<HTMLElement>("*")]
    .filter(
      (element) =>
        element instanceof HTMLElement &&
        element.offsetWidth > 0 &&
        element.offsetHeight > 0 &&
        !sticky.some((bar) => bar.contains(element)) &&
        element.checkVisibility({ visibilityProperty: true }),
    )
    .map((element) => ({ element, place: place(element) }));
}

export type Comparison = { moved: Moved[]; target: Place | null };

/** What moved or changed size since `snapshotLayout`, among elements on screen both times. */
export function compareLayout(targetId: string): Comparison {
  const LABEL_LENGTH = 40;
  const before = globalThis.zoonkLayout ?? [];
  const target = document.querySelector(`[data-zoonk-act="${targetId}"]`);

  function place(element: HTMLElement) {
    let left = 0;
    let top = 0;

    for (
      let current: HTMLElement | null = element;
      current;
      current = current.offsetParent instanceof HTMLElement ? current.offsetParent : null
    ) {
      left += current.offsetLeft;
      top += current.offsetTop;
    }

    return { height: element.offsetHeight, left, top, width: element.offsetWidth };
  }

  function label(element: HTMLElement) {
    const labelledById = element.getAttribute("aria-labelledby")?.split(" ")[0];
    const labelledBy = labelledById ? document.querySelector(`#${CSS.escape(labelledById)}`) : null;

    const named =
      element.getAttribute("aria-label") ??
      // oxlint-disable-next-line unicorn/prefer-dom-node-text-content -- Only `innerText` leaves out hidden text.
      (labelledBy instanceof HTMLElement ? labelledBy.innerText : null) ??
      // oxlint-disable-next-line unicorn/prefer-dom-node-text-content -- Only `innerText` leaves out hidden text.
      element.innerText;

    const text = named.replaceAll(/\s+/gu, " ").trim().slice(0, LABEL_LENGTH);
    const slot = element.dataset.slot ? `[data-slot=${element.dataset.slot}]` : "";
    return `${element.tagName.toLowerCase()}${slot}${text ? ` "${text}"` : ""}`;
  }

  function drawn(element: HTMLElement) {
    const style = getComputedStyle(element);
    const fill = style.backgroundColor !== "rgba(0, 0, 0, 0)";
    const border = Number(style.borderTopWidth.replace("px", "")) > 0;
    const ring = /(?:^|,\s*)\S+ 0px 0px 0px [1-9]/u.test(style.boxShadow);

    const control = element.matches(
      "button, input, select, textarea, img, video, canvas, [role=button], [role=tab], [role=radio], [role=checkbox], [role=option]",
    );

    return control || (element.offsetWidth < innerWidth - 2 && (fill || border || ring));
  }

  const was = new Map(before.map(({ element, place: where }) => [element, where]));

  const now = new Map(
    before
      .filter(
        ({ element }) =>
          element.isConnected &&
          element.offsetWidth > 0 &&
          element.offsetHeight > 0 &&
          element.checkVisibility({ visibilityProperty: true }),
      )
      .map(({ element }) => [element, place(element)]),
  );

  function delta(element: HTMLElement | null) {
    const from = element ? was.get(element) : undefined;
    const to = element ? now.get(element) : undefined;
    return from && to ? `${to.left - from.left},${to.top - from.top}` : null;
  }

  const moved = before.flatMap(({ element, place: from }) => {
    const to = now.get(element);

    if (
      !to ||
      (to.left === from.left &&
        to.top === from.top &&
        to.width === from.width &&
        to.height === from.height)
    ) {
      return [];
    }

    return [
      {
        after: to,
        before: from,
        carried: delta(element.parentElement) === delta(element),
        drawn: drawn(element),
        holds: target !== null && element !== target && element.contains(target),
        isTarget: element === target,
        label: label(element),
      },
    ];
  });

  return { moved, target: target instanceof HTMLElement ? place(target) : null };
}
