/* oxlint-disable max-lines-per-function, max-statements, unicorn/consistent-function-scoping -- Each function is sent to the page on its own, so its helpers live inside it (`probe.mts`). */

/** Where an element sits in the layout and how big it is, in CSS pixels, transforms left out. */
export type Place = { height: number; left: number; top: number; width: number };

export type Moved = {
  after: Place;
  before: Place;
  /** Its parent moved by the same amount, so it only went along. */
  carried: boolean;
  /** It contains what was acted on, as a form holds its field. */
  holds: boolean;
  /** A scenario declares it an anchor (a sheet's frame, a pinned action): its size must hold. */
  anchor: boolean;
  /** A control, panel or picture: its own size is part of the screen. */
  drawn: boolean;
  /** It is inside what was acted on, so it goes wherever that goes. */
  inside: boolean;
  isTarget: boolean;
  label: string;
  /** A control whose own words changed ("Save" becoming "Remove focus"). */
  reworded: boolean;
};

/**
 * A search field is a field whose list below it changes as a person types. A panel toggle (the
 * sidebar's) folds a column away, so the rest of the screen reflows sideways by design.
 */
type ActionKind = "control" | "field" | "fold" | "overlay" | "panel" | "pick" | "search";

/**
 * `role` is the control's ARIA role, written or implied; `name` its accessible name. A plain
 * control's `effect` says why a press holds it without clicking: a link would leave the page, a
 * submit button would send the form, and any other button may write or start a model call.
 */
export type Action = {
  controls?: string;
  effect?: "button" | "link" | "submit";
  id: string;
  kind: ActionKind;
  label: string;
  name: string;
  returnTo?: string;
  role: string;
};

/** `layer` is the nearest fixed or absolute box around an element (itself included), if any. */
type Snapshot = { element: HTMLElement; layer: HTMLElement | null; place: Place; words?: string }[];

declare global {
  // oxlint-disable-next-line no-var -- A page global is declared with `var`.
  var zoonkLayout: Record<string, Snapshot> | undefined;
  // oxlint-disable-next-line no-var -- A page global is declared with `var`.
  var zoonkMoved: HTMLElement[] | undefined;
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
      !element.closest("[inert], [aria-hidden=true], [data-zoonk-act], [data-slot=command-item]") &&
      !element.querySelector("[data-zoonk-act]") &&
      !element.matches(":disabled, [aria-disabled=true], [readonly]") &&
      element.checkVisibility({ opacityProperty: true, visibilityProperty: true })
    );
  }

  function name(element: Element) {
    return (globalThis.zoonkPage.label(element) || element.id).slice(0, LABEL_LENGTH);
  }

  function label(element: Element) {
    const text = name(element);
    return `${element.tagName.toLowerCase()}${text ? ` "${text}"` : ""}`;
  }

  const IMPLIED_ROLES: [string, string][] = [
    ["a[href]", "link"],
    ["input[type=checkbox]", "checkbox"],
    ["input[type=radio]", "radio"],
    ["input[type=search]", "searchbox"],
    ["input, textarea", "textbox"],
    ["select", "combobox"],
    ["summary, button", "button"],
  ];

  function roleOf(element: Element, found: Element) {
    const written = element.getAttribute("role") ?? found.getAttribute("role");

    return (
      written ??
      IMPLIED_ROLES.find(([selector]) => found.matches(selector))?.[1] ??
      element.tagName.toLowerCase()
    );
  }

  function effectOf(element: Element): Action["effect"] {
    if (element.matches("a[href]")) {
      return "link";
    }

    const submits =
      element.matches("[type=submit]") ||
      (element.matches("button:not([type])") && element.closest("form") !== null);

    return submits ? "submit" : "button";
  }

  function kindOf(element: Element): ActionKind {
    if (element.matches("[data-slot=sidebar-toggle]")) {
      return "panel";
    }

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

        const menu = element.closest("[role=menu]");

        const trigger = menu?.id
          ? [...document.querySelectorAll("[aria-haspopup=menu]")].find((node) =>
              node.getAttribute("aria-controls")?.split(/\s+/u).includes(menu.id),
            )
          : null;

        const kind = kindOf(found);

        const controls =
          (found.getAttribute("aria-controls") ?? element.getAttribute("aria-controls")) ||
          undefined;

        actions.push({
          controls,
          effect: kind === "control" ? effectOf(element) : undefined,
          id,
          kind,
          label: label(element),
          name: name(element),
          returnTo: trigger instanceof HTMLElement ? trigger.dataset.zoonkAct : undefined,
          role: roleOf(element, found),
        });
      }
    }
  }

  return actions;
}

/**
 * Remembers where every element on screen sits, for `compareLayout`, under `slot` (a step's start,
 * or a press's, which its undo is compared with). Positions come from `offsetLeft`/`offsetTop`,
 * which leave out transforms (a pressed button's scale, a sheet sliding in) and scrolling, so only
 * what the layout moved counts. A sticky bar's offset follows the scroll, which acting on the page
 * changes, so it and what's in it are left out.
 */
export function snapshotLayout(slot = "step") {
  const WORDED = "button, [role=button], [role=tab], a[href]";
  const { place } = globalThis.zoonkPage;
  const all = [...document.body.querySelectorAll<HTMLElement>("*")];
  const positions = new Map(all.map((element) => [element, getComputedStyle(element).position]));
  const sticky = all.filter((element) => positions.get(element) === "sticky");

  function layerOf(element: HTMLElement | null) {
    for (
      let current = element;
      current && current !== document.body;
      current = current.parentElement
    ) {
      const position = positions.get(current);

      if (position === "fixed" || position === "absolute") {
        return current;
      }
    }

    return null;
  }

  globalThis.zoonkLayout = {
    ...globalThis.zoonkLayout,
    [slot]: all
      .filter(
        (element) =>
          element instanceof HTMLElement &&
          element.offsetWidth > 0 &&
          element.offsetHeight > 0 &&
          !sticky.some((bar) => bar.contains(element)) &&
          element.checkVisibility({ visibilityProperty: true }),
      )
      .map((element) => ({
        element,
        layer: layerOf(element),
        place: place(element),
        words: element.matches(WORDED) ? (element.textContent ?? "") : undefined,
      })),
  };
}

export type Comparison = { moved: Moved[]; target: Place | null };

/**
 * `request` is what was acted on, and with it the selectors of every declared anchor and the
 * snapshot to compare with (`step` by default). The elements that moved are kept in `zoonkMoved`,
 * in the same order, so a picture can mark them.
 */
export function compareLayout(
  request: string | { anchors: string; from?: string; targetId: string },
): Comparison {
  const {
    anchors,
    from = "step",
    targetId,
  } = typeof request === "string" ? { anchors: "", targetId: request } : request;

  const LABEL_LENGTH = 40;
  const before = globalThis.zoonkLayout?.[from] ?? [];
  const target = document.querySelector(`[data-zoonk-act="${targetId}"]`);

  const { place } = globalThis.zoonkPage;

  function label(element: HTMLElement) {
    const text = globalThis.zoonkPage.label(element).slice(0, LABEL_LENGTH);
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
    const start = element ? was.get(element) : undefined;
    const to = element ? now.get(element) : undefined;
    return start && to ? `${to.left - start.left},${to.top - start.top}` : null;
  }

  const changed = before.filter(({ element, place: start }) => {
    const to = now.get(element);

    return (
      to !== undefined &&
      (to.left !== start.left ||
        to.top !== start.top ||
        to.width !== start.width ||
        to.height !== start.height)
    );
  });

  globalThis.zoonkMoved = changed.map(({ element }) => element);

  const moved = changed.map(({ element, place: start, words }) => ({
    after: now.get(element) ?? start,
    anchor: anchors !== "" && element.matches(anchors),
    before: start,
    carried: delta(element.parentElement) === delta(element),
    drawn: drawn(element),
    holds: target !== null && element !== target && element.contains(target),
    inside: target !== null && element !== target && target.contains(element),
    isTarget: element === target,
    label: label(element),
    reworded: words !== undefined && (element.textContent ?? "") !== words,
  }));

  return { moved, target: target instanceof HTMLElement ? place(target) : null };
}

/** The `data-zoonk-act` of every choice now picked, so the walk can put a radio group back. */
export function pickedIds() {
  return [
    ...document.querySelectorAll(
      "[aria-checked=true], [aria-selected=true], [aria-pressed=true], input:checked",
    ),
  ]
    .map((node) => {
      const holder = node.closest("[data-zoonk-act]") ?? node;
      return holder instanceof HTMLElement ? (holder.dataset.zoonkAct ?? null) : null;
    })
    .filter((id) => id !== null);
}
