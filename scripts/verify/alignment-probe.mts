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
  actions: controls,
  pieces,
  surfaces,
}: {
  actions: string;
  pieces: { name: string; web: WebPiece }[];
  surfaces: string;
}): AlignmentPage {
  const TENTH = 10;
  const LABEL_LENGTH = 32;
  const { shown } = globalThis.zoonkPage;
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

  const inkOf = globalThis.zoonkPage.ink;

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
   * The first line's baseline: the top of its first glyph run plus the font's ascent. It matched a
   * zero-size inline-block marker to 0.00 px on Geist and Geist Mono, 12 to 24 px, one and two
   * lines, and needs no change to the page, so a text that is a flex item reads right too.
   */
  function baselineOf(text: Text): number | null {
    const range = document.createRange();
    range.selectNodeContents(text);
    const first = [...range.getClientRects()].find((rect) => rect.width > 0);
    const style = text.parentElement ? getComputedStyle(text.parentElement) : null;

    if (!first || !style || !pen) {
      return null;
    }

    pen.font = fontOf(style);
    const metrics = pen.measureText(text.data.trim());
    const content = metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;
    return first.top + (first.height - content) / 2 + metrics.fontBoundingBoxAscent;
  }

  /** The characters the primary face's own `@font-face` ranges cover: it draws them, no fallback does. */
  function primaryRanges(style: CSSStyleDeclaration): [number, number][] {
    const family = style.fontFamily.split(",")[0]?.replaceAll(/["']/gu, "").trim() ?? "";

    return [...document.fonts]
      .filter((face) => face.family.replaceAll(/["']/gu, "") === family)
      .flatMap((face) => face.unicodeRange.split(","))
      .flatMap((range): [number, number][] => {
        const [low = "", high = low] = range.trim().replace(/^U\+/iu, "").split("-");
        const start = Number.parseInt(low.replaceAll("?", "0"), 16);
        const end = Number.parseInt(high.replaceAll("?", "F"), 16);
        return Number.isNaN(start) || Number.isNaN(end) ? [] : [[start, end]];
      });
  }

  function drawnByPrimary(text: string, style: CSSStyleDeclaration) {
    const ranges = primaryRanges(style);

    const codes: number[] = [];

    // A string iterates by code point, so a character past the basic plane is one.
    for (const character of text) {
      if (!/\s/u.test(character)) {
        codes.push(character.codePointAt(0) ?? 0);
      }
    }

    return (
      ranges.length > 0 &&
      codes.every((code) => ranges.some(([start, end]) => code >= start && code <= end))
    );
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
      .filter(
        (node) =>
          node.nodeType === Node.TEXT_NODE &&
          node.textContent?.trim() &&
          node.parentElement &&
          shown(node.parentElement),
      )
      .flatMap((node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        return [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0);
      });

    const top = Math.min(...rects.map((rect) => rect.top));
    const line = union(rects.filter((rect) => rect.top < top + rect.height / 2));
    const style = getComputedStyle(first.parentElement ?? element);
    const base = baselineOf(first);
    // The cap height is the primary face's: a text another face draws has no capitals to read.
    const cap = drawnByPrimary(first.data, style) ? capHeight(style) : null;

    return {
      baseline: base === null ? "not measured" : round(base + scrollY),
      capBottom: base === null || cap === null ? "not measured" : round(base + scrollY),
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

  /** A `display: contents` element has no box: it is there when what it holds draws. */
  function isContents(element: Element) {
    return getComputedStyle(element).display === "contents";
  }

  function present(element: Element) {
    return isContents(element) ? inkOf(element) !== null : shown(element);
  }

  function boxOf(element: Element): Rect {
    return (isContents(element) ? inkOf(element) : null) ?? element.getBoundingClientRect();
  }

  function isRtl(element: Element) {
    return getComputedStyle(element).direction === "rtl";
  }

  /** Where its content ends: the right edge, or the left one in a right-to-left layout. */
  function contentEnd(element: Element) {
    const box = boxOf(element);
    const style = getComputedStyle(element);
    const { pixels } = globalThis.zoonkPage;

    return isRtl(element)
      ? box.left + pixels(style.paddingLeft) + pixels(style.borderLeftWidth)
      : box.right - pixels(style.paddingRight) - pixels(style.borderRightWidth);
  }

  /** A row wrapped in `display: contents` is its children. */
  function expandRows(element: Element): Element[] {
    return isContents(element)
      ? [...element.children].flatMap((child) => expandRows(child))
      : [element];
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
          present(element) &&
          !matches.some((other) => other !== element && other.contains(element)),
      );

      return found.map((element, index): CaptureElement => {
        const ink = inkOf(element);
        const isText = part !== "mark" && part !== "end";

        return {
          bounds: bounds(boxOf(element)),
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
        bounds: bounds(boxOf(row)),
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

    const candidates = [...group.querySelectorAll(piece.rows)]
      .flatMap((row) => expandRows(row))
      .filter(
        (row) => isRowOf(row) && !["absolute", "fixed"].includes(getComputedStyle(row).position),
      );

    const rows = candidates.filter(
      (row) => present(row) && !candidates.some((other) => other !== row && other.contains(row)),
    );

    const bar = piece.bar ? group.querySelector(piece.bar) : null;
    const groupInk = inkOf(group);
    const read = { bar, group, groupId, piece, pieceName, rows };
    const flows = [...new Set(rows.map((row) => unitIn(row, group).parentElement))];

    return [
      {
        bounds: bounds(boxOf(group)),
        ...(isRtl(group) ? { direction: "rtl" as const } : {}),
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
      .filter((group) => present(group))
      .flatMap((group, groupIndex) => readGroup(pieceName, piece, group, groupIndex)),
  );

  const covers = [...document.querySelectorAll(surfaces)].filter((surface) => present(surface));
  const surfaceName = (cover: Element) => `${name(cover)} #${covers.indexOf(cover) + 1}`;

  /** The surface on top: the one whose own middle the document hits inside it, not the last in order. */
  const onTop = covers.filter((cover) => {
    const box = boxOf(cover);
    const hit = document.elementFromPoint((box.left + box.right) / 2, (box.top + box.bottom) / 2);
    return hit !== null && cover.contains(hit);
  });

  const top = onTop.at(-1) ?? covers.at(-1);

  const surfaceOf = (element: Element) => {
    const cover = covers.findLast((surface) => surface.contains(element));
    return cover ? surfaceName(cover) : "page";
  };

  const filled = (control: Element) =>
    getComputedStyle(control).getPropertyValue("--button-variant").trim() === "default";

  const actions = [...document.querySelectorAll(controls)]
    .filter((action) => filled(action) && present(action))
    .map((action, index): CaptureElement => {
      const target = action instanceof HTMLAnchorElement ? action.href : null;

      return {
        bounds: bounds(boxOf(action)),
        group: null,
        id: `action.${index}`,
        ink: bounds(boxOf(action)),
        name: name(action),
        part: "action",
        piece: "action",
        row: null,
        surface: surfaceOf(action),
        text: globalThis.zoonkPage.label(action),
        ...(target ? { target } : {}),
        variant: "filled",
      };
    });

  return { activeSurface: top ? surfaceName(top) : "page", elements: [...elements, ...actions] };
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
