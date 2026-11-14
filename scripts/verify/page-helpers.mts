/* oxlint-disable unicorn/consistent-function-scoping -- The installer is serialized into each measured page. */
declare global {
  // oxlint-disable-next-line no-var -- A page global is declared with `var`.
  var zoonkPage: {
    label: (element: Element, visibleOnly?: boolean) => string;
    /** It draws a box: a fill that differs from what's behind it, a border on these sides, or a ring. */
    paints: (element: Element, sides?: readonly ("bottom" | "left" | "right" | "top")[]) => boolean;
    pixels: (value: string) => number;
    place: (element: HTMLElement) => { height: number; left: number; top: number; width: number };
    rgba: (color: string) => [number, number, number, number];
    /** Its rings (`ring-*`), as their spread outside it; 0 for an inset one. */
    rings: (element: Element) => number[];
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

  const MIN_FILL_DIFFERENCE = 6;
  const OPAQUE = 255;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const paint = canvas.getContext("2d", { willReadFrequently: true });

  /** Any CSS color (`oklch`, `lab`, …) as the RGBA the screen draws, through a canvas. */
  function rgba(color: string): [number, number, number, number] {
    if (!paint) {
      return [0, 0, 0, 0];
    }

    paint.clearRect(0, 0, 1, 1);
    paint.fillStyle = color;
    paint.fillRect(0, 0, 1, 1);
    const [red = 0, green = 0, blue = 0, alpha = 0] = paint.getImageData(0, 0, 1, 1).data;
    return [red, green, blue, alpha];
  }

  function behind(element: Element) {
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const color = rgba(getComputedStyle(parent).backgroundColor);

      if (color[3] > 0) {
        return color;
      }
    }

    return rgba(getComputedStyle(document.body).backgroundColor);
  }

  function filled(element: Element) {
    const fill = rgba(getComputedStyle(element).backgroundColor);
    const under = behind(element);
    const alpha = fill[3] / OPAQUE;

    const difference = under
      .slice(0, 3)
      .reduce(
        (total, channel, index) => total + Math.abs(((fill[index] ?? 0) - channel) * alpha),
        0,
      );

    return alpha > 0 && difference > MIN_FILL_DIFFERENCE;
  }

  /** The rings it draws (`ring-*`: a box shadow with no offset or blur), as their spread outside it. */
  function rings(element: Element) {
    return getComputedStyle(element)
      .boxShadow.split(/,(?![^(]*\))/u)
      .flatMap((shadow) => {
        const color = /^(?:[a-z]+\([^)]*\)|#\w+|[a-z]+)/iu.exec(shadow.trim())?.[0] ?? "";
        const rest = shadow.trim().slice(color.length).trim();
        const [x, y, blur, spread = 0] = rest.split(/\s+/u).map((part) => pixels(part));
        const ring = x === 0 && y === 0 && blur === 0 && spread > 0 && rgba(color)[3] > 0;

        if (!ring) {
          return [];
        }

        return [rest.endsWith("inset") ? 0 : spread];
      });
  }

  function paints(
    element: Element,
    sides: readonly ("bottom" | "left" | "right" | "top")[] = ["left", "right"],
  ) {
    const style = getComputedStyle(element);

    return (
      filled(element) ||
      rings(element).length > 0 ||
      sides.every(
        (side) =>
          pixels(style.getPropertyValue(`border-${side}-width`)) > 0 &&
          rgba(style.getPropertyValue(`border-${side}-color`))[3] > 0,
      )
    );
  }

  globalThis.zoonkPage = { label, paints, pixels, place, rgba, rings, shown };
}
