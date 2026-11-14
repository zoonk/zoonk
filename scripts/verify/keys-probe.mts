/* oxlint-disable max-lines-per-function, unicorn/consistent-function-scoping, unicorn/no-array-callback-reference -- Each function is sent to the page on its own, so its helpers live inside it (`probe.mts`). */

/** The control a key clicked, as the page describes it; null when the key clicked nothing. */
export type Pressed = {
  id: string | null;
  drawn: boolean;
  enter: string | null;
  keycap: boolean;
  label: string;
  taskClose: boolean;
} | null;

declare global {
  // oxlint-disable-next-line no-var -- A page global is declared with `var`.
  var zoonkPressed: Pressed | undefined;
  // oxlint-disable-next-line no-var -- A page global is declared with `var`.
  var zoonkRecord: ((event: MouseEvent) => void) | undefined;
  // oxlint-disable-next-line no-var -- A page global is declared with `var`.
  var zoonkChecked: Set<Element> | undefined;
  // oxlint-disable-next-line no-var -- A page global is declared with `var`.
  var zoonkDescribePress: ((control: Element) => NonNullable<Pressed>) | undefined;
}

/** Blurs the page and records, then swallows, the next click a key causes. */
export function recordNextClick() {
  const LABEL_LENGTH = 40;
  globalThis.zoonkPressed = null;

  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }

  globalThis.zoonkChecked = new Set(document.querySelectorAll(":checked, [aria-checked=true]"));

  function describe(control: Element): NonNullable<Pressed> {
    return {
      drawn: control.getClientRects().length > 0,
      enter: control instanceof HTMLElement ? (control.dataset.enter ?? null) : null,
      id: control instanceof HTMLElement ? (control.dataset.zoonkKey ?? null) : null,
      keycap: [...control.querySelectorAll("[data-shortcut=main]")].some(
        (keycap) => keycap.getClientRects().length > 0,
      ),
      label:
        control.getAttribute("aria-label") ?? control.textContent.trim().slice(0, LABEL_LENGTH),
      taskClose: control.matches("[data-slot=task-close]"),
    };
  }

  globalThis.zoonkDescribePress = describe;

  function record(event: MouseEvent) {
    event.preventDefault();
    event.stopImmediatePropagation();

    const host =
      event.target instanceof Element ? event.target.closest("a, button, label, [role]") : null;

    const control =
      host instanceof HTMLLabelElement
        ? (host.control ?? host.querySelector("[role=radio], [role=checkbox]"))
        : host;

    globalThis.zoonkPressed = control ? describe(control) : null;
  }

  globalThis.zoonkRecord = record;
  document.addEventListener("click", record, { capture: true, once: true });
}

export function takeRecordedClick(): Pressed {
  if (globalThis.zoonkRecord) {
    document.removeEventListener("click", globalThis.zoonkRecord, { capture: true });
  }

  const checked = [...document.querySelectorAll(":checked, [aria-checked=true]")].find(
    (control) => !globalThis.zoonkChecked?.has(control),
  );

  return (
    globalThis.zoonkPressed ?? (checked ? globalThis.zoonkDescribePress?.(checked) : null) ?? null
  );
}

/** What the page draws: its sidebars, main actions, groups and keycaps, by the pieces' hooks. */
export function readHooks() {
  const LABEL_LENGTH = 40;
  const drawn = (element: Element) => element.getClientRects().length > 0;

  const text = (element: Element) =>
    element.getAttribute("aria-label") ?? element.textContent.trim().slice(0, LABEL_LENGTH);

  const wide = (selector: string) =>
    [...document.querySelectorAll(selector)].some(
      (element) => element.getBoundingClientRect().width > 0,
    );

  [...document.querySelectorAll("a, button, input, [role]")].forEach((control, index) => {
    if (control instanceof HTMLElement) {
      control.dataset.zoonkKey = `key-${index}`;
    }
  });

  const identify = (element: Element) => ({
    id: element instanceof HTMLElement ? (element.dataset.zoonkKey ?? "") : "",
    label: text(element),
  });

  return {
    bound: [...document.querySelectorAll("[data-enter=bound]")]
      .filter((element) => drawn(element) && !element.matches(":disabled, [aria-disabled=true]"))
      .map(identify),
    keycaps: [...document.querySelectorAll("[data-slot=shortcut-kbd][data-shortcut]")]
      .filter(drawn)
      .flatMap((keycap) => {
        const host = keycap.closest("a, button, label, [role]");

        const control =
          host instanceof HTMLLabelElement
            ? (host.control ?? host.querySelector("[role=radio], [role=checkbox]"))
            : host;

        return control && keycap instanceof HTMLElement
          ? [
              {
                announced: control.getAttribute("aria-keyshortcuts"),
                canPress:
                  !control.matches(":disabled, [aria-disabled=true]") &&
                  !(keycap.dataset.shortcut === "main" && control.matches("[data-enter=host]")),
                control: text(control) || (host ? text(host) : ""),
                id: control instanceof HTMLElement ? (control.dataset.zoonkKey ?? "") : "",
                keycap: keycap.textContent.trim(),
                name: keycap.dataset.shortcut ?? "",
              },
            ]
          : [];
      }),
    sidebars: [
      ...(wide("[data-slot=sidebar]") ? ["start"] : []),
      ...(wide("[data-slot=task-aside]") ? ["end"] : []),
    ],
    task: document.querySelector("[data-task-header]") !== null,
    taskClose: [...document.querySelectorAll("[data-slot=task-close]")].some(drawn),
    toggles: [...document.querySelectorAll("[data-slot=sidebar-toggle]")]
      .filter(drawn)
      .map((toggle) =>
        toggle instanceof HTMLElement ? (toggle.dataset.side ?? "start") : "start",
      ),
  };
}

/** Its width, and the `html` attributes that say which side is folded. */
export function readSidebar(side: string) {
  const slot = side === "end" ? "[data-slot=task-aside]" : "[data-slot=sidebar]";

  return [
    document.querySelector(slot)?.getBoundingClientRect().width ?? 0,
    ...[...document.documentElement.attributes]
      .filter((attribute) => attribute.name.endsWith("-collapsed"))
      .map((attribute) => `${attribute.name}=${attribute.value}`),
  ].join(" ");
}

export function readPanel({
  phone,
  overlays,
  opener,
}: {
  phone: boolean;
  overlays: { panel: string; backdrop: string }[];
  opener: string;
}) {
  const LABEL_LENGTH = 40;
  const LIGHT_DIM = 0.5;
  const DARK_DIM = 0.7;
  const selector = overlays.map(({ panel }) => `[data-slot=${panel}]`).join(", ");

  const { shown } = globalThis.zoonkPage;

  const last = (query: string) =>
    [...document.querySelectorAll<HTMLElement>(query)].toReversed().find(shown);

  const known = last(`${selector}, [role=menu]`);
  const panel = known ?? last("[role=dialog], [role=alertdialog]");

  if (!panel) {
    return null;
  }

  delete document.querySelector<HTMLElement>(`[data-zoonk-popup="${opener}"]`)?.dataset.zoonkPopup;
  panel.dataset.zoonkPopup = opener;

  function alpha(color: string, black = false) {
    if (color === "transparent") {
      return 0;
    }

    const parts = color
      .match(/[\d.]+%?/gu)
      ?.map((part) => Number(part.replace(/%$/u, "")) / (part.endsWith("%") ? 100 : 1));

    return parts?.length && (!black || parts.slice(0, 3).every((part) => part === 0))
      ? (parts[3] ?? 1)
      : null;
  }

  function dim(slot: string | undefined) {
    const expected = matchMedia("(prefers-color-scheme: dark)").matches ? DARK_DIM : LIGHT_DIM;
    const backdrop = slot ? last(`[data-slot=${slot}]`) : null;

    if (backdrop?.matches("[data-starting-style], [data-ending-style]")) {
      return null;
    }

    const style = backdrop ? getComputedStyle(backdrop) : null;
    const opacity = style ? alpha(style.backgroundColor, true) : null;

    return {
      actual: style && opacity !== null ? opacity * Number(style.opacity || 1) : null,
      blur: style?.backdropFilter || "none",
      expected,
    };
  }

  function edge() {
    const content = panel?.querySelector("[data-slot=drawer-content]");
    const footer = content?.nextElementSibling;

    if (!content || !footer?.matches("[data-slot=drawer-footer]")) {
      return null;
    }

    const style = getComputedStyle(content);
    const overflowing = content.scrollHeight > content.clientHeight + 1;
    const atEnd = content.scrollTop + content.clientHeight >= content.scrollHeight - 1;

    return {
      drawn:
        style.borderBottomStyle === "solid" &&
        Number(style.borderBottomWidth.replace(/px$/u, "")) === 1 &&
        alpha(style.borderBottomColor) !== 0,
      expected: overflowing && !atEnd,
      padding: Number(getComputedStyle(footer).paddingTop.replace(/px$/u, "")),
    };
  }

  const box = panel.getBoundingClientRect();
  const slot = panel.dataset.slot;
  const menu = panel.getAttribute("role") === "menu";
  const title = panel.querySelector("h2, [data-slot$=-title]")?.textContent.trim();

  function centered() {
    if (phone || slot !== "drawer-popup") {
      return null;
    }

    return (
      Math.abs((box.left + box.right) / 2 - innerWidth / 2) <= 2 &&
      Math.abs((box.top + box.bottom) / 2 - innerHeight / 2) <= 2 &&
      ![...(panel?.querySelectorAll("[data-slot=drawer-handle]") ?? [])].some(shown)
    );
  }

  return {
    centered: centered(),
    closeDrawn: [
      ...panel.querySelectorAll(
        "[data-slot=drawer-close], [data-slot=dialog-close], [data-slot=side-panel-close], [data-slot$=-footer] button",
      ),
    ].some(shown),
    dim: known && !menu ? dim(overlays.find(({ panel: piece }) => piece === slot)?.backdrop) : null,
    edge: edge(),
    focusInside: known ? panel.contains(document.activeElement) : null,
    label:
      panel.getAttribute("aria-label") ??
      title?.slice(0, LABEL_LENGTH) ??
      (menu ? "a menu" : "a panel"),
    needsClose: Boolean(known) && panel.getAttribute("role") === "dialog",
    shared: Boolean(known),
    sheet: known && !menu && phone ? Math.abs(box.bottom - innerHeight) <= 2 : null,
  };
}

/** Whether Esc closed a panel or menu and restored its opener's focus. */
export function focusReturned({ opener, returnTo }: { opener: string; returnTo?: string }) {
  const panel = document.querySelector(`[data-zoonk-popup="${opener}"]`);

  if (panel && globalThis.zoonkPage.shown(panel)) {
    return false;
  }

  const focused = document.activeElement;
  const trigger = document.querySelector(`[data-zoonk-act="${opener}"]`);

  if (trigger?.closest("[data-task-header]") && trigger.matches("[aria-haspopup=menu]")) {
    return Boolean(focused?.closest("[data-enter], [data-slot=task-frame-body]"));
  }

  return [trigger, returnTo ? document.querySelector(`[data-zoonk-act="${returnTo}"]`) : null].some(
    (target) => target && (target === focused || target.contains(focused)),
  );
}
