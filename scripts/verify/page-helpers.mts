/* oxlint-disable unicorn/consistent-function-scoping -- The installer is serialized into each measured page. */
declare global {
  // oxlint-disable-next-line no-var -- A page global is declared with `var`.
  var zoonkPage: {
    label: (element: Element, visibleOnly?: boolean) => string;
    pixels: (value: string) => number;
    place: (element: HTMLElement) => { height: number; left: number; top: number; width: number };
    shown: (element: Element) => boolean;
  };
}

export function installPageHelpers() {
  function shown(element: Element) {
    const box = element.getBoundingClientRect();

    return (
      box.width > 1 &&
      box.height > 1 &&
      getComputedStyle(element).clipPath !== "inset(50%)" &&
      element.checkVisibility({ opacityProperty: true, visibilityProperty: true })
    );
  }

  function label(element: Element, visibleOnly = false) {
    const id = element.getAttribute("aria-labelledby")?.split(" ")[0];
    const labelledBy = id ? document.querySelector(`#${CSS.escape(id)}`) : null;
    const source = visibleOnly ? element : (labelledBy ?? element);
    // oxlint-disable-next-line unicorn/prefer-dom-node-text-content -- The label leaves hidden words out.
    const text = source instanceof HTMLElement ? source.innerText : source.textContent;

    return (
      ((visibleOnly ? text : (element.getAttribute("aria-label") ?? text)) ?? "")
        .replaceAll(/\s+/gu, " ")
        .trim() ||
      element.getAttribute("placeholder") ||
      ""
    );
  }

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

  function pixels(value: string) {
    return Number(value.replace(/px$/u, "")) || 0;
  }

  globalThis.zoonkPage = { label, pixels, place, shown };
}
