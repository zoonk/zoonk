import { type Bounds, type Capture, type CaptureElement } from "./alignment-capture.mts";
/* oxlint-disable max-lines, max-lines-per-function, max-statements, complexity, unicorn/consistent-function-scoping -- `readAlignment` is sent to the page as one function, so its helpers live inside it (`probe.mts`). */
import { type Part, type WebPiece } from "./alignment-table.mts";
import { type Scheme, VIEWPORTS, type ViewportName } from "./viewports.mts";

export type AlignmentPage = Pick<Capture, "activeSurface" | "elements">;

/**
 * Runs in the browser, so it reads nothing outside itself and its arguments. Positions are page
 * pixels, rounded to a tenth, like the craft read's, so they match a full-page screenshot.
 */
export function readAlignment({
  filled,
  pieces,
  surfaces,
}: {
  filled: string;
  pieces: { name: string; web: WebPiece }[];
  surfaces: string;
}): AlignmentPage {
  const TENTH = 10;
  const LABEL_LENGTH = 32;
  const HALF = 0.5;
  const { paints, shown } = globalThis.zoonkPage;
  const { scrollX, scrollY } = globalThis;

  const round = (value: number) => Math.round(value * TENTH) / TENTH;

  const bounds = (rect: { bottom: number; left: number; right: number; top: number }): Bounds => [
    round(rect.left + scrollX),
    round(rect.top + scrollY),
    round(rect.right - rect.left),
    round(rect.bottom - rect.top),
  ];

  type Rect = { bottom: number; left: number; right: number; top: number };

  function union(rects: Rect[]): Rect | null {
    if (rects.length === 0) {
      return null;
    }

    return {
      bottom: Math.max(...rects.map((rect) => rect.bottom)),
      left: Math.min(...rects.map((rect) => rect.left)),
      right: Math.max(...rects.map((rect) => rect.right)),
      top: Math.min(...rects.map((rect) => rect.top)),
    };
  }

  function name(element: Element): string {
    const text = globalThis.zoonkPage.label(element, true).slice(0, LABEL_LENGTH);

    if (text) {
      return `"${text}"`;
    }

    const slot = element instanceof HTMLElement ? element.dataset.slot : undefined;
    return `<${element.tagName.toLowerCase()}${slot ? ` ${slot}` : ""}>`;
  }

  function textRects(node: Node): DOMRect[] {
    const range = document.createRange();
    range.selectNodeContents(node);
    return [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0);
  }

  /** A Lucide glyph by its drawn shape (stroke included); any other picture by its frame. */
  function glyphRect(svg: SVGSVGElement): Rect | null {
    const matrix = svg.getScreenCTM();
    const shape = svg.getBBox();

    if (!matrix || shape.width === 0 || shape.height === 0) {
      return null;
    }

    if (!svg.classList.contains("lucide")) {
      return svg.getBoundingClientRect();
    }

    const style = getComputedStyle(svg);

    const half =
      style.stroke === "none" ? 0 : globalThis.zoonkPage.pixels(style.strokeWidth) * HALF;

    const corners = [
      new DOMPoint(shape.x - half, shape.y - half),
      new DOMPoint(shape.x + shape.width + half, shape.y + shape.height + half),
    ].map((point) => point.matrixTransform(matrix));

    return union(
      corners.map((point) => ({ bottom: point.y, left: point.x, right: point.x, top: point.y })),
    );
  }

  /** What an element draws: its text, its glyphs and pictures, and the boxes it or its children paint. */
  function inkOf(element: Element): Rect | null {
    if (!shown(element)) {
      return null;
    }

    if (element instanceof SVGSVGElement) {
      return glyphRect(element);
    }

    if (element.matches("img, video, canvas, input, textarea, select")) {
      return element.getBoundingClientRect();
    }

    const own = paints(element, ["top", "right", "bottom", "left"])
      ? [element.getBoundingClientRect()]
      : [];

    const texts = [...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
      .flatMap((node) => textRects(node));

    const children = [...element.children].flatMap((child) => {
      const ink = inkOf(child);
      return ink ? [ink] : [];
    });

    return union([...own, ...texts, ...children]);
  }

  /** Room held by something that draws nothing, hidden things included (opacity 0, `invisible`). */
  function holdsRoom(element: Element) {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);

    // Out of the flow (a spinner laid over a glyph, words only for screen readers), it holds no room.
    // An empty slot can hold room one way only: 20 px wide and no height in a row.
    if (
      (box.width < 1 && box.height < 1) ||
      style.display === "contents" ||
      ["absolute", "fixed"].includes(style.position)
    ) {
      return false;
    }

    const visible = element.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    return !visible || inkOf(element) === null;
  }

  /** The outermost elements inside `root` that hold room and draw nothing. */
  function holders(root: Element): Element[] {
    return [...root.children].flatMap((child) => {
      if (holdsRoom(child)) {
        return [child];
      }

      const outOfFlow = ["absolute", "fixed"].includes(getComputedStyle(child).position);
      return child instanceof SVGElement || outOfFlow ? [] : holders(child);
    });
  }

  const pen = document.createElement("canvas").getContext("2d");

  function fontOf(style: CSSStyleDeclaration) {
    return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  }

  function typeToken(style: CSSStyleDeclaration) {
    const family = style.fontFamily.split(",")[0]?.replaceAll(/["']/gu, "").trim() ?? "";
    return `${family} ${style.fontSize} ${style.fontWeight} ${style.lineHeight}`;
  }

  /** The text that carries a part: its longest run of words, so a number before a title isn't it. */
  function mainText(element: Element): Text | null {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (
        node instanceof Text &&
        node.textContent?.trim() &&
        node.parentElement &&
        shown(node.parentElement)
      ) {
        nodes.push(node);
      }
    }

    return (
      nodes.toSorted(
        (one, other) =>
          (other.textContent?.trim().length ?? 0) - (one.textContent?.trim().length ?? 0),
      )[0] ?? null
    );
  }

  function firstText(element: Element): Text | null {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (
        node instanceof Text &&
        node.textContent?.trim() &&
        node.parentElement &&
        shown(node.parentElement)
      ) {
        return node;
      }
    }

    return null;
  }

  /**
   * The first line's baseline, read from a zero-size inline block put before the first letter: an
   * inline block with no content sits on the baseline. It changes no line box, and is removed at once.
   */
  function baselineOf(text: Text): number | null {
    const marker = document.createElement("span");

    marker.style.cssText =
      "display:inline-block;width:0;height:0;margin:0;padding:0;border:0;vertical-align:baseline";

    const offset = text.textContent?.search(/\S/u) ?? 0;
    const after = offset > 0 ? text.splitText(offset) : text;
    after.before(marker);
    const { bottom } = marker.getBoundingClientRect();
    marker.remove();

    if (after !== text) {
      text.appendData(after.data);
      after.remove();
    }

    return Number.isFinite(bottom) ? bottom : null;
  }

  function capHeight(style: CSSStyleDeclaration): number | null {
    if (!pen) {
      return null;
    }

    pen.font = fontOf(style);
    return pen.measureText("H").actualBoundingBoxAscent;
  }

  function textMetrics(
    element: Element,
  ): Pick<
    CaptureElement,
    "baseline" | "capBottom" | "capTop" | "firstLine" | "lines" | "text" | "type"
  > {
    const first = firstText(element);
    const main = mainText(element) ?? first;

    if (!first || !main?.parentElement) {
      return {};
    }

    const rects = [...element.querySelectorAll("*"), element]
      .flatMap((node) => [...node.childNodes])
      .filter((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
      .flatMap((node) => textRects(node));

    const top = Math.min(...rects.map((rect) => rect.top));
    const line = union(rects.filter((rect) => rect.top < top + rect.height / 2));
    const style = getComputedStyle(first.parentElement ?? element);
    const base = baselineOf(first);
    const cap = capHeight(style);

    return {
      baseline: base === null ? "not measured" : round(base + scrollY),
      capBottom: base === null ? "not measured" : round(base + scrollY),
      capTop: base === null || cap === null ? "not measured" : round(base - cap + scrollY),
      ...(line ? { firstLine: bounds(line) } : {}),
      lines: lineCount(rects),
      text: (main.textContent ?? "").trim().slice(0, LABEL_LENGTH),
      type: typeToken(getComputedStyle(main.parentElement)),
    };
  }

  /** Rects of one line overlap by more than half; a mono number and its title's words are one line. */
  function lineCount(rects: DOMRect[]) {
    const lines: DOMRect[] = [];

    for (const rect of rects.toSorted((one, other) => one.top - other.top)) {
      const last = lines.at(-1);

      if (!last || rect.top >= last.top + last.height / 2) {
        lines.push(rect);
      }
    }

    return lines.length;
  }

  function contentEnd(element: Element) {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const { pixels } = globalThis.zoonkPage;
    return box.right - pixels(style.paddingRight) - pixels(style.borderRightWidth);
  }

  function flowGap(parent: Element) {
    const style = getComputedStyle(parent);
    const { pixels } = globalThis.zoonkPage;

    if (!/flex|grid/u.test(style.display)) {
      return 0;
    }

    return pixels(
      style.flexDirection.startsWith("row") && style.display.includes("flex")
        ? style.columnGap
        : style.rowGap,
    );
  }

  /** A row's unit in the group's flow: itself, or the ancestor that is a child of `parent`. */
  function unitIn(row: Element, group: Element) {
    let unit = row;

    while (
      unit.parentElement &&
      unit.parentElement !== group &&
      !unit.parentElement.matches("ol, ul")
    ) {
      unit = unit.parentElement;
    }

    return unit;
  }

  const PARTS: Part[] = ["mark", "lead", "label", "note", "value", "end"];
  /** Room held inside `root` by something that draws nothing, named for a finding to point at. */
  function holderElements(
    root: Element,
    ids: { group: string; piece: string; prefix: string; row: string | null },
    skip: (holder: Element) => boolean = () => false,
  ) {
    return holders(root)
      .filter((holder) => !skip(holder))
      .map((holder, index): CaptureElement => ({
        bounds: bounds(holder.getBoundingClientRect()),
        group: ids.group,
        id: `${ids.prefix}.holder${index}`,
        ink: null,
        name: name(holder),
        part: "holder",
        piece: ids.piece,
        row: ids.row,
      }));
  }

  type Read = {
    bar: Element | null;
    group: Element;
    groupId: string;
    piece: WebPiece;
    pieceName: string;
    rows: Element[];
  };

  /** The row each element belongs to: the nearest of the group's rows around it. */
  function ownerRow(element: Element, rows: Element[]) {
    let owner: Element | null = element;

    while (owner && !rows.includes(owner)) {
      owner = owner.parentElement;
    }

    return owner;
  }

  function readParts(read: Read, row: Element, rowId: string): CaptureElement[] {
    return PARTS.flatMap((part) => {
      const selector = read.piece.parts[part];

      if (!selector) {
        return [];
      }

      const matches = [...row.querySelectorAll(selector)];

      const found = matches.filter(
        (element) =>
          ownerRow(element, read.rows) === row &&
          element.getBoundingClientRect().width > 0 &&
          !matches.some((other) => other !== element && other.contains(element)),
      );

      return found.map((element, index): CaptureElement => {
        const ink = inkOf(element);
        const isText = part !== "mark" && part !== "end";

        return {
          bounds: bounds(element.getBoundingClientRect()),
          group: read.groupId,
          id: `${rowId}.${part}${index}`,
          ink: ink ? bounds(ink) : null,
          name: name(element),
          part,
          piece: read.pieceName,
          row: rowId,
          ...(isText && ink ? textMetrics(element) : {}),
        };
      });
    });
  }

  function readRow(
    read: Read,
    row: Element,
    rowIndex: number,
    flows: (Element | null)[],
  ): CaptureElement[] {
    const { pixels } = globalThis.zoonkPage;
    const rowId = `${read.groupId}.${rowIndex}`;
    const unit = unitIn(row, read.group);
    const chain: Element[] = [];

    for (
      let link: Element | null = row;
      link && link !== unit.parentElement;
      link = link.parentElement
    ) {
      chain.push(link);
    }

    // Its own margins count with its unit's: both are the layout's declared room.
    const margin = (side: "marginBottom" | "marginTop") =>
      chain.reduce((total, link) => total + pixels(getComputedStyle(link)[side]), 0);

    const rowInk = inkOf(row);
    const { note } = read.piece.parts;

    return [
      {
        bounds: bounds(row.getBoundingClientRect()),
        endEdge: round(
          (read.bar ? read.bar.getBoundingClientRect().right : contentEnd(row)) + scrollX,
        ),
        flow: `${read.groupId}.${flows.indexOf(unit.parentElement)}`,
        gapBefore: unit.parentElement ? flowGap(unit.parentElement) : 0,
        group: read.groupId,
        id: rowId,
        ink: rowInk ? bounds(rowInk) : null,
        margins: [margin("marginTop"), margin("marginBottom")],
        name: name(row),
        note: note ? [...row.querySelectorAll(note)].some((element) => shown(element)) : false,
        part: "row",
        piece: read.pieceName,
        row: null,
      },
      ...readParts(read, row, rowId),
      ...holderElements(row, {
        group: read.groupId,
        piece: read.pieceName,
        prefix: rowId,
        row: rowId,
      }),
    ];
  }

  function readGroup(
    pieceName: string,
    piece: WebPiece,
    group: Element,
    groupIndex: number,
  ): CaptureElement[] {
    const groupId = `${pieceName}.${groupIndex}`;

    const isRowOf = (row: Element) =>
      row.closest(piece.group) === group || row.parentElement?.closest(piece.group) === group;

    const candidates = [...group.querySelectorAll(piece.rows)].filter(
      (row) => isRowOf(row) && !["absolute", "fixed"].includes(getComputedStyle(row).position),
    );

    const rows = candidates.filter(
      (row) => shown(row) && !candidates.some((other) => other !== row && other.contains(row)),
    );

    if (rows.length === 0) {
      return [];
    }

    const bar = piece.bar ? group.querySelector(piece.bar) : null;
    const groupInk = inkOf(group);
    const read = { bar, group, groupId, piece, pieceName, rows };
    const flows = [...new Set(rows.map((row) => unitIn(row, group).parentElement))];

    return [
      {
        bounds: bounds(group.getBoundingClientRect()),
        endEdge: round((bar ? bar.getBoundingClientRect().right : contentEnd(group)) + scrollX),
        group: null,
        id: groupId,
        ink: groupInk ? bounds(groupInk) : null,
        name: name(group.getAttribute("aria-label") ? group : (rows[0] ?? group)),
        part: "group",
        piece: pieceName,
        row: null,
      },
      ...rows.flatMap((row, rowIndex) => readRow(read, row, rowIndex, flows)),
      // Between rows: what holds room in the group outside every row.
      ...holderElements(
        group,
        { group: groupId, piece: pieceName, prefix: groupId, row: null },
        (holder) => rows.some((row) => row.contains(holder) || holder.contains(row)),
      ),
    ];
  }

  const elements = pieces.flatMap(({ name: pieceName, web: piece }) =>
    [...document.querySelectorAll(piece.group)]
      .filter((group) => shown(group))
      .flatMap((group, groupIndex) => readGroup(pieceName, piece, group, groupIndex)),
  );

  const covers = [...document.querySelectorAll(surfaces)].filter((surface) => shown(surface));

  const surfaceOf = (element: Element) => {
    const cover = covers.findLast((surface) => surface.contains(element));
    return cover ? name(cover) : "page";
  };

  const actions = [...document.querySelectorAll(filled)]
    .filter((action) => shown(action))
    .map((action, index): CaptureElement => ({
      bounds: bounds(action.getBoundingClientRect()),
      group: null,
      id: `action.${index}`,
      ink: bounds(action.getBoundingClientRect()),
      name: name(action),
      part: "action",
      piece: "action",
      row: null,
      surface: surfaceOf(action),
      variant: "filled",
    }));

  const top = covers.at(-1);

  return { activeSurface: top ? name(top) : "page", elements: [...elements, ...actions] };
}

/** The UI's locale is the path's first segment where it names one (`/pt/plan`). */
function localeOf(path: string) {
  return /^\/(?<locale>[a-z]{2})(?:\/|$)/u.exec(path)?.groups?.locale ?? "en";
}

/** A load's capture, in the shape every platform writes. */
export function webCapture({
  page,
  path,
  scheme,
  viewport,
}: {
  page: AlignmentPage;
  path: string;
  scheme: Scheme;
  viewport: ViewportName;
}): Capture {
  const size = VIEWPORTS[viewport];

  return {
    ...page,
    configuration: {
      height: size.viewport?.height ?? 0,
      locale: localeOf(path),
      pointer: size.hasTouch ? "touch" : "keys",
      scheme,
      size: viewport,
      textScale: 1,
      width: size.viewport?.width ?? 0,
    },
    platform: "web",
    scale: size.deviceScaleFactor ?? 1,
    scenario: null,
    screen: path,
    unit: "px",
    version: 1,
  };
}
