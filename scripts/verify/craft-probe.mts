/* oxlint-disable max-lines, max-lines-per-function, max-statements, complexity, unicorn/consistent-function-scoping -- `readCraft` is sent to the page as one function, so its helpers live inside it (`probe.mts`). */
export type InkKind = "box" | "icon" | "picture" | "text";

/**
 * What a person sees, in page coordinates: text by its own line boxes, an icon by its drawn shape,
 * a picture by its frame (a character keeps its blank margins), a control or a panel by the box its
 * fill, border or ring draws. `context` is the drawn box it sits in (-1 for the page), since a
 * panel's padding is its own edge. An edge counts only where the layout put it: a centered item's
 * sides, a ragged line's end and a word mid-sentence don't.
 */
export type Ink = {
  /** An icon alone in a button or a link with no fill or border: a bare glyph (E2). */
  bare?: boolean;
  bottom: number;
  context: number;
  /** For a box, the context its own contents are in. */
  inner?: number;
  /**
   * For a text, where its first and last letters are drawn: letters start and end a little inside
   * their box, and a glyph beside a text is compared with the letters (E2).
   */
  inkLeft?: number;
  inkRight?: number;
  kind: InkKind;
  label: string;
  left: number;
  leftCounts: boolean;
  lines: number;
  right: number;
  rightCounts: boolean;
  top: number;
};

export type Control = {
  bottom: number;
  height: number;
  kind: "button" | "field" | "panel";
  label: string;
  left: number;
  /** Its largest corner, or -1 for a pill (a corner at least half its height). */
  radius: number;
  right: number;
  top: number;
  width: number;
};

/** A Lucide icon; `stroke` is its `stroke-width` on the 24-unit canvas, null when it's filled. */
export type Icon = { label: string; size: number; stroke: number | null };

export type TextStyle = {
  /** The list row or panel it's in, or -1. */
  block: number;
  /** Inside a sentence (a bold word), so it's emphasis rather than a level of its own. */
  inline: boolean;
  label: string;
  size: number;
};

/** Siblings of one kind (same tag and classes) in a stack or a row, with the gaps between them. */
export type GapGroup = {
  /** The layout spreads them (`justify-content: space-*`), so nobody chose their gaps. */
  distributed: boolean;
  gaps: number[];
  label: string;
};

export type CraftPage = {
  controls: Control[];
  gaps: GapGroup[];
  icons: Icon[];
  ink: Ink[];
  /** The page's `--radius`, which the design system's corners step from. */
  radius: number;
  texts: TextStyle[];
};

type Box = { bottom: number; left: number; right: number; top: number };

/**
 * Runs in the browser, so it reads nothing outside itself. Positions are rounded to a tenth of a
 * pixel and relative to the page, so they match the full-page screenshot.
 */
export function readCraft(): CraftPage {
  const LABEL_LENGTH = 32;
  const ICON_MAX = 32;
  const SMALLEST_CONTROL = 24;
  const HAIRLINE = 4;
  /** Wider than a button: something centered in it is placed by the center, not by its sides. */
  const CENTERING_AREA = 56;
  const CENTER_SLACK = 8;
  /** Room a parent leaves beyond its children's gaps when it pushes the last one to its end. */
  const PUSH_ROOM = 16;
  const MIN_SIBLINGS = 3;
  const MIN_FILL_DIFFERENCE = 6;
  const OPAQUE = 255;
  const HALF = 0.5;
  const TENTH = 10;
  const viewportWidth = document.documentElement.clientWidth;
  const { scrollX, scrollY } = globalThis;

  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const paint = canvas.getContext("2d", { willReadFrequently: true });

  function round(value: number) {
    return Math.round(value * TENTH) / TENTH;
  }

  /** Computed lengths are always in pixels, such as "16px". */
  function pixels(value: string) {
    return Number(value.replace(/px$/u, "")) || 0;
  }

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

  function shown(element: Element) {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);

    return (
      box.width > 1 &&
      box.height > 1 &&
      style.clipPath !== "inset(50%)" &&
      element.checkVisibility({ opacityProperty: true, visibilityProperty: true })
    );
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

  function bordered(element: Element, sides: ("bottom" | "left" | "right" | "top")[]) {
    const style = getComputedStyle(element);

    return (
      rings(element).length > 0 ||
      sides.every(
        (side) =>
          pixels(style.getPropertyValue(`border-${side}-width`)) > 0 &&
          rgba(style.getPropertyValue(`border-${side}-color`))[3] > 0,
      )
    );
  }

  /** A panel or a control: something that draws its own edges, not a full-width bar or a hairline. */
  function drawn(element: Element) {
    const box = element.getBoundingClientRect();

    return (
      element instanceof HTMLElement &&
      element !== document.body &&
      box.width < viewportWidth - 2 &&
      box.width >= HAIRLINE &&
      box.height >= HAIRLINE &&
      (filled(element) || bordered(element, ["left", "right"]))
    );
  }

  function label(element: Element): string {
    const named =
      element.getAttribute("aria-label") ??
      // oxlint-disable-next-line unicorn/prefer-dom-node-text-content -- Only `innerText` leaves out hidden text.
      (element instanceof HTMLElement ? element.innerText : element.textContent);

    const text = named?.replaceAll(/\s+/gu, " ").trim().slice(0, LABEL_LENGTH) ?? "";

    if (text) {
      return `"${text}"`;
    }

    const icon = [...element.classList].find((name) => /^lucide-(?!icon$)/u.test(name));
    const name = icon ? `${icon.slice("lucide-".length)} icon` : element.tagName.toLowerCase();
    const holder = element.closest("a, button, [role=button], label");

    return holder && holder !== element ? `${name} in ${label(holder)}` : name;
  }

  const all = [...document.body.querySelectorAll("*")].filter((element) => shown(element));
  const contexts = all.filter((element) => drawn(element));

  function contextOf(element: Element, start: Element | null = element.parentElement) {
    for (let parent = start; parent; parent = parent.parentElement) {
      const index = contexts.indexOf(parent);

      if (index !== -1) {
        return index;
      }
    }

    return -1;
  }

  function contentBox(element: Element) {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);

    return {
      left: box.left + pixels(style.paddingLeft) + pixels(style.borderLeftWidth),
      right: box.right - pixels(style.paddingRight) - pixels(style.borderRightWidth),
    };
  }

  /** The nearest box the layout places: an inline element's text flows in its block. */
  function laidOut(element: Element) {
    let current: Element | null = element;

    while (current && ["contents", "inline"].includes(getComputedStyle(current).display)) {
      current = current.parentElement;
    }

    return current;
  }

  /**
   * It sits in the middle of an area wider than a button, or in a row that spreads its items (the
   * tabs), so its sides follow from a center rather than an edge.
   */
  function centered(element: Element, box: Box) {
    const middle = (box.left + box.right) / 2;
    const width = box.right - box.left;

    for (
      let parent = element.parentElement;
      parent && parent !== document.body;
      parent = parent.parentElement
    ) {
      const style = getComputedStyle(parent);
      const area = contentBox(parent);
      const spread = /^space-(?:around|evenly)$/u.test(style.justifyContent);

      const inMiddle =
        parent.getBoundingClientRect().width > CENTERING_AREA &&
        area.right - area.left - width >= CENTER_SLACK &&
        Math.abs((area.left + area.right) / 2 - middle) <= 1;

      if ((spread && style.display.includes("flex")) || inMiddle) {
        return true;
      }

      if (contexts.includes(parent)) {
        return false;
      }
    }

    return false;
  }

  /**
   * The layout puts its right side: a text's ink ends where its box does (`textRight`), and that box
   * (or the invisible one around it, such as a ghost button) is pushed to its row's end or fills
   * its column.
   */
  function endPlaced(element: Element, textRight?: number) {
    let current = laidOut(element);

    if (
      !current ||
      (textRight !== undefined && Math.abs(contentBox(current).right - textRight) > 1)
    ) {
      return false;
    }

    for (
      let parent = current.parentElement;
      current && parent && parent !== document.body;
      parent = parent.parentElement
    ) {
      const box = current.getBoundingClientRect();
      const area = contentBox(laidOut(parent) ?? parent);

      if (Math.abs(box.right - area.right) > 1) {
        return false;
      }

      const taken = [...parent.children]
        .map((child) => child.getBoundingClientRect())
        .filter((child) => child.bottom > box.top && child.top < box.bottom)
        .reduce((total, child) => total + child.width, 0);

      // A parent that hugs its children (an icon and its words) doesn't push the last one anywhere.
      const pushed = box.left > area.left + 1 && area.right - area.left - taken > PUSH_ROOM;
      // A box filling its column ends on the column's edge; a text filling its holder may not.
      const fills = textRight === undefined && box.left <= area.left + 1;

      if (pushed || fills || contexts.includes(parent)) {
        return true;
      }

      current = parent;
    }

    return true;
  }

  function place(rect: Box) {
    return {
      bottom: round(rect.bottom + scrollY),
      left: round(rect.left + scrollX),
      right: round(rect.right + scrollX),
      top: round(rect.top + scrollY),
    };
  }

  function union(rects: Box[]): Box {
    return {
      bottom: Math.max(...rects.map((rect) => rect.bottom)),
      left: Math.min(...rects.map((rect) => rect.left)),
      right: Math.max(...rects.map((rect) => rect.right)),
      top: Math.min(...rects.map((rect) => rect.top)),
    };
  }

  const blocks = all.filter(
    (element) => element.matches("li, [role=listitem]") || contexts.includes(element),
  );

  function ownText(element: Element) {
    return [...element.childNodes].filter(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
    );
  }

  const pen = document.createElement("canvas").getContext("2d");

  /** How far inside its box a text's first and last letters are drawn. */
  function bearings(element: Element, style: CSSStyleDeclaration) {
    const words = ownText(element)
      .map((node) => node.textContent?.trim() ?? "")
      .join("");

    const cased = style.textTransform === "uppercase" ? words.toUpperCase() : words;
    const [first, last] = [cased.at(0), cased.at(-1)];

    if (!pen || !first || !last) {
      return { end: 0, start: 0 };
    }

    pen.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    pen.letterSpacing = style.letterSpacing === "normal" ? "0px" : style.letterSpacing;
    const lastLetter = pen.measureText(last);

    return {
      end: lastLetter.width - lastLetter.actualBoundingBoxRight,
      start: -pen.measureText(first).actualBoundingBoxLeft,
    };
  }

  const written = all.flatMap((element) => {
    const rects = ownText(element).flatMap((node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      return [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0);
    });

    if (rects.length === 0 || element instanceof SVGElement) {
      return [];
    }

    const style = getComputedStyle(element);
    const box = union(rects);
    const flow = contentBox(laidOut(element) ?? document.body);
    const middle = style.textAlign === "center" || centered(element, box);
    const end = ["end", "right"].includes(style.textAlign);
    const lines = new Set(rects.map((rect) => Math.round(rect.top))).size;
    const holder = blocks.findLast((candidate) => candidate.contains(element));
    const letters = bearings(element, style);

    return [
      {
        ink: {
          ...place(box),
          context: contextOf(element, element),
          inkLeft: round(box.left + scrollX + letters.start),
          inkRight: round(box.right + scrollX - letters.end),
          kind: "text" as const,
          label: label(element),
          leftCounts: !middle && !end && Math.abs(box.left - flow.left) <= 1,
          lines,
          rightCounts: !middle && (end || (lines === 1 && endPlaced(element, box.right))),
        },
        style: {
          block: holder ? blocks.indexOf(holder) : -1,
          inline: style.display === "inline" && box.left > flow.left + 1,
          label: label(element),
          size: round(pixels(style.fontSize)),
        },
      },
    ];
  });

  const drawings = all
    .filter((element): element is SVGSVGElement => element instanceof SVGSVGElement)
    .flatMap((svg) => {
      const matrix = svg.getScreenCTM();
      const shape = svg.getBBox();

      // A chart lines up by its plot, not by its axis labels.
      if (!matrix || shape.width === 0 || shape.height === 0 || svg.querySelector("text")) {
        return [];
      }

      const style = getComputedStyle(svg);
      const stroked = style.stroke !== "none" && rgba(style.stroke)[3] > 0;
      const half = stroked ? pixels(style.strokeWidth) * HALF : 0;
      const frame = svg.getBoundingClientRect();

      const icon =
        svg.classList.contains("lucide") && frame.width <= ICON_MAX && frame.height <= ICON_MAX;

      const corners = [
        new DOMPoint(shape.x - half, shape.y - half),
        new DOMPoint(shape.x + shape.width + half, shape.y + shape.height + half),
      ].map((point) => point.matrixTransform(matrix));

      const glyph = union(
        corners.map((point) => ({ bottom: point.y, left: point.x, right: point.x, top: point.y })),
      );

      const middle = centered(svg, frame);
      const holder = svg.closest("a, button, [role=button]");

      // Its name only for screen readers (`sr-only`) isn't shown, so it doesn't count as words.
      const bare =
        icon &&
        holder !== null &&
        ![holder, ...holder.querySelectorAll("*")].some(
          (element) => ownText(element).length > 0 && shown(element),
        ) &&
        !filled(holder) &&
        !bordered(holder, ["left", "right"]);

      return [
        {
          icon: icon
            ? {
                label: label(svg),
                size: round(Math.max(frame.width, frame.height)),
                stroke: stroked && style.fill === "none" ? round(pixels(style.strokeWidth)) : null,
              }
            : null,
          ink: {
            ...place(icon ? glyph : frame),
            bare,
            context: contextOf(svg),
            kind: icon ? ("icon" as const) : ("picture" as const),
            label: label(svg),
            leftCounts: !middle,
            lines: 1,
            rightCounts: !middle && endPlaced(svg),
          },
        },
      ];
    });

  const pictures = all
    .filter((element) => element.matches("img, video, canvas"))
    .map((element) => {
      const box = element.getBoundingClientRect();
      const middle = centered(element, box);

      return {
        ...place(box),
        context: contextOf(element),
        kind: "picture" as const,
        label: label(element),
        leftCounts: !middle,
        lines: 1,
        rightCounts: !middle && endPlaced(element),
      };
    });

  const boxes = contexts.map((element, index) => {
    const frame = element.getBoundingClientRect();
    const outside = Math.max(0, ...rings(element));

    const box = {
      bottom: frame.bottom + outside,
      left: frame.left - outside,
      right: frame.right + outside,
      top: frame.top - outside,
    };

    const middle = centered(element, box);

    return {
      ...place(box),
      context: contextOf(element),
      inner: index,
      kind: "box" as const,
      label: label(element),
      leftCounts: !middle,
      lines: 1,
      rightCounts: !middle && endPlaced(element),
    };
  });

  const BUTTON = String.raw`button, [role=button], a[data-slot=button], a.group\/button`;
  const FIELD = `input:not([type=checkbox], [type=radio], [type=hidden], [type=range]), select, textarea, [role=combobox]`;
  const TOGGLE = "[role=checkbox], [role=switch], [role=radio], [role=slider]";

  function controlKind(element: Element) {
    if (element.matches(FIELD)) {
      return "field" as const;
    }

    if (element.matches(BUTTON)) {
      return "button" as const;
    }

    return contexts.includes(element) && !element.matches("img, svg, video, canvas")
      ? ("panel" as const)
      : null;
  }

  function corner(value: string, box: DOMRect) {
    const [first = "0"] = value.split(" ");
    const shorter = Math.min(box.width, box.height);
    return first.endsWith("%") ? (Number(first.slice(0, -1)) / 100) * shorter : pixels(first);
  }

  const controls = all.flatMap((element) => {
    const kind = controlKind(element);
    const box = element.getBoundingClientRect();

    if (
      !kind ||
      box.width < SMALLEST_CONTROL ||
      box.height < SMALLEST_CONTROL ||
      element.matches(TOGGLE) ||
      !(filled(element) || bordered(element, ["top", "right", "bottom", "left"]))
    ) {
      return [];
    }

    const style = getComputedStyle(element);

    const largest = Math.max(
      ...[
        style.borderTopLeftRadius,
        style.borderTopRightRadius,
        style.borderBottomRightRadius,
        style.borderBottomLeftRadius,
      ].map((value) => corner(value, box)),
    );

    return [
      {
        ...place(box),
        height: round(box.height),
        kind,
        label: label(element),
        radius: largest >= box.height / 2 - HALF ? -1 : round(largest),
        width: round(box.width),
      },
    ];
  });

  function sameKind(one: Element, other: Element) {
    return (
      one.tagName === other.tagName && one.getAttribute("class") === other.getAttribute("class")
    );
  }

  const gaps = all.flatMap((parent) => {
    const children = [...parent.children].filter(
      (child) =>
        all.includes(child) && !["absolute", "fixed"].includes(getComputedStyle(child).position),
    );

    const [first] = children;

    if (
      !first ||
      children.length < MIN_SIBLINGS ||
      !children.every((child) => sameKind(child, first))
    ) {
      return [];
    }

    const rects = children.map((child) => child.getBoundingClientRect());
    const pairs = rects.slice(1).map((rect, index) => ({ previous: rects[index] ?? rect, rect }));
    const stacked = pairs.every(({ previous, rect }) => rect.top >= previous.bottom - 1);
    const inRow = pairs.every(({ previous, rect }) => rect.left >= previous.right - 1);

    if (!stacked && !inRow) {
      return [];
    }

    return [
      {
        distributed: getComputedStyle(parent).justifyContent.startsWith("space-"),
        gaps: pairs.map(({ previous, rect }) =>
          round(stacked ? rect.top - previous.bottom : rect.left - previous.right),
        ),
        label: label(parent),
      },
    ];
  });

  const probe = document.createElement("div");
  probe.style.borderRadius = "var(--radius)";
  document.body.append(probe);
  const radius = pixels(getComputedStyle(probe).borderTopLeftRadius);
  probe.remove();

  const pageHeight = document.documentElement.scrollHeight;

  const ink = [
    ...written.map((text) => text.ink),
    ...drawings.map((drawing) => drawing.ink),
    ...pictures,
    ...boxes,
  ];

  return {
    controls,
    gaps,
    icons: drawings.flatMap((drawing) => (drawing.icon ? [drawing.icon] : [])),
    // Kept out: what sits off the page (a hidden measurer) or past its sides (a row that scrolls).
    ink: ink.filter(
      (item) =>
        item.bottom > 0 &&
        item.top < pageHeight &&
        item.left >= -1 &&
        item.right <= viewportWidth + 1,
    ),
    radius,
    texts: written.map((text) => text.style),
  };
}
