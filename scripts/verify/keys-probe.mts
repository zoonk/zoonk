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

  const mainActions = [...document.querySelectorAll("[data-slot=button][data-variant=default]")];

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
    unbuilt:
      document.querySelector("[data-enter]") === null
        ? mainActions
            .filter(
              (element) =>
                drawn(element) &&
                element instanceof HTMLElement &&
                ["lg", "xl"].includes(element.dataset.size ?? "") &&
                !element.matches(":disabled"),
            )
            .map(text)
        : [],
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

export function readPanel(phone: boolean) {
  const LABEL_LENGTH = 40;

  const panel = [...document.querySelectorAll("[role=dialog], [role=alertdialog]")].find(
    (element) => !element.closest("[data-slot=toast]") && element.checkVisibility(),
  );

  if (!panel) {
    return null;
  }

  const drawn = (element: Element) => element.getClientRects().length > 0;
  const box = panel.getBoundingClientRect();
  const dialog = panel.getAttribute("role") === "dialog";
  const popover = panel.matches("[data-slot=popover-content]");
  const desktopPalette = !phone && panel.querySelector("[data-slot=command-input]") !== null;

  const drawer =
    panel.closest("[data-slot=drawer-popup]") ?? panel.querySelector("[data-slot=drawer-popup]");

  const title = panel.querySelector("h2, [data-slot$=-title]")?.textContent.trim();

  return {
    centered:
      !phone && drawer
        ? Math.abs((box.left + box.right) / 2 - innerWidth / 2) <= 2 &&
          Math.abs((box.top + box.bottom) / 2 - innerHeight / 2) <= 2 &&
          ![...panel.querySelectorAll("[data-slot=drawer-handle]")].some(drawn)
        : null,
    closeDrawn: [
      ...panel.querySelectorAll(
        "[data-slot=drawer-close], [data-slot=dialog-close], [data-slot$=-footer] button",
      ),
    ].some(drawn),
    focusInside: panel.contains(document.activeElement),
    label: panel.getAttribute("aria-label") ?? title?.slice(0, LABEL_LENGTH) ?? "a panel",
    needsClose:
      dialog &&
      !popover &&
      !desktopPalette &&
      !panel.closest("[data-slot=suggestion-sheet]") &&
      !panel.querySelector("[data-slot=suggestion-sheet]"),
    sheet: phone && dialog && !popover ? Math.abs(box.bottom - innerHeight) <= 2 : null,
  };
}

/**
 * Whether Esc closed the panel and focus came back to what opened it; a task's menu gives focus to
 * the task instead.
 */
export function focusReturned(opener: string) {
  if (
    [...document.querySelectorAll("[role=dialog], [role=alertdialog]")].some(
      (panel) => !panel.closest("[data-slot=toast]") && panel.checkVisibility(),
    )
  ) {
    return false;
  }

  const focused = document.activeElement;
  const trigger = document.querySelector(`[data-zoonk-act="${opener}"]`);

  if (trigger?.closest("[data-task-header]") && trigger.matches("[aria-haspopup=menu]")) {
    return Boolean(focused?.closest("[data-enter], [data-slot=task-frame-body]"));
  }

  return trigger !== null && (trigger === focused || trigger.contains(focused));
}
