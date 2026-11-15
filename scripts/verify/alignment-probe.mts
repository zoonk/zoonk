import { type Bounds, type Capture, type CaptureElement } from "./alignment-capture.mts";
/* oxlint-disable max-lines, max-lines-per-function, max-statements, complexity, unicorn/consistent-function-scoping -- `readAlignment` is sent to the page as one function, so its helpers live inside it (`probe.mts`). */
import { type Part, type WebPiece } from "./alignment-table.mts";
import { type Scheme, VIEWPORTS, type ViewportName } from "./viewports.mts";

export type AlignmentPage = Pick<Capture, "activeSurface" | "elements">;

/**
 * Runs in the browser, so it reads nothing outside itself and its arguments. Positions are page
 * pixels as measured, so a full-page screenshot shows them; the evaluator rounds only what it
 * prints, never what it compares.
 */
export function readAlignment({
  actions: controls,
  anchors = [],
  columns,
  pieces,
  pinned: pinnedBars,
  surfaces,
}: {
  actions: string;
  /** A scenario's anchors: the first showing match of each is written for its state pair. */
  anchors?: { id: string; web: string }[];
  columns: string;
  pieces: { name: string; web: WebPiece }[];
  /** Bars pinned to the screen's bottom, which nothing rests under at the scroll's end. */
  pinned: string;
  surfaces: string;
}): AlignmentPage {
  const LABEL_LENGTH = 32;
  const { shown } = globalThis.zoonkPage;
  const { scrollX, scrollY } = globalThis;

  const bounds = (rect: { bottom: number; left: number; right: number; top: number }): Bounds => [
    rect.left + scrollX,
    rect.top + scrollY,
    rect.right - rect.left,
    rect.bottom - rect.top,
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

    // Not rendered at all (a closed `<details>`'s answer) holds no room, though it keeps a size.
    if (!element.checkVisibility()) {
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
        present(node.parentElement)
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
        present(node.parentElement)
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

  /** Scripts with no capitals, set on their ideographic face: Han and kana, and Hangul. */
  const HAN_KANA = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
  const HANGUL = /\p{Script=Hangul}/u;

  /**
   * A script with no capitals is centered by its ideographic face, the box its glyphs are drawn
   * in, not by a string's ink, which differs between "一" and "書". The face is read from a
   * full-frame glyph through the same fonts, so it is the fallback face's: on Chromium it sits
   * within 0.4 px of the line box's middle at 12 to 24 px, in Japanese and Korean
   * (`evidence-ideographic` in the alignment build notes).
   */
  function ideographicFace(text: string, style: CSSStyleDeclaration) {
    const glyph = HAN_KANA.test(text) ? "国" : HANGUL.test(text) && "국";

    if (!pen || !glyph) {
      return null;
    }

    pen.font = fontOf(style);
    const metrics = pen.measureText(glyph);
    return { ascent: metrics.actualBoundingBoxAscent, descent: metrics.actualBoundingBoxDescent };
  }

  function textMetrics(
    element: Element,
  ): Pick<
    CaptureElement,
    "baseline" | "capBottom" | "capTop" | "firstLine" | "lines" | "text" | "textBox" | "type"
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
          present(node.parentElement),
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
    const face = cap === null ? ideographicFace(first.data, style) : null;
    const box = cap === null ? face : { ascent: cap, descent: 0 };

    return {
      baseline: base === null ? "not measured" : base + scrollY,
      capBottom: base === null || box === null ? "not measured" : base + box.descent + scrollY,
      capTop: base === null || box === null ? "not measured" : base - box.ascent + scrollY,
      ...(box ? { textBox: face ? ("ideographic face" as const) : ("capitals" as const) } : {}),
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

  /**
   * It, or what it holds, draws: a group with no box of its own (`display: contents`, or no height
   * with its rows overflowing) is there by its rows. Hidden content, such as a closed `details`,
   * draws nothing and stays out.
   */
  function present(element: Element) {
    return shown(element) || inkOf(element) !== null;
  }

  /** Its own box, or what it draws where it has no box of its own. */
  function boxOf(element: Element): Rect {
    const own = isContents(element) || !shown(element) ? inkOf(element) : null;
    return own ?? element.getBoundingClientRect();
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

  /** The middle of what a row lays out, inside a divider's border and its padding. */
  function contentMiddle(element: Element) {
    const box = boxOf(element);
    const style = getComputedStyle(element);
    const { pixels } = globalThis.zoonkPage;
    const top = box.top + pixels(style.borderTopWidth) + pixels(style.paddingTop);
    const bottom = box.bottom - pixels(style.borderBottomWidth) - pixels(style.paddingBottom);
    return (top + bottom) / 2;
  }

  /** A row that holds a nested group (a phase and its open events) is its own line above it. */
  function rowMiddle(row: Element, groups: string) {
    const nested = [...row.querySelectorAll(groups)].find((group) => present(group));

    if (!nested) {
      return contentMiddle(row);
    }

    const top = boxOf(row).top + globalThis.zoonkPage.pixels(getComputedStyle(row).paddingTop);
    return (top + boxOf(nested).top) / 2;
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

      // `:scope` is the row itself: a top bar's action is its own label.
      const matches = selector === ":scope" ? [row] : [...row.querySelectorAll(selector)];

      // A part inside a nested group (a phase's open events) is that group's, not this row's.
      const found = matches.filter(
        (element) =>
          ownerRow(element, read.rows) === row &&
          element.closest(read.piece.group) === read.group &&
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

  /** A piece's parts outside its rows, placed in the group itself. */
  function groupParts(read: Read): CaptureElement[] {
    return PARTS.flatMap((part) => {
      const selector = read.piece.groupParts?.[part];

      const element = selector
        ? [...read.group.querySelectorAll(selector)].find((found) => present(found))
        : undefined;

      if (!element) {
        return [];
      }

      const ink = inkOf(element);

      return [
        {
          bounds: bounds(boxOf(element)),
          group: read.groupId,
          id: `${read.groupId}.${part}`,
          ink: ink ? bounds(ink) : null,
          name: name(element),
          part,
          piece: read.pieceName,
          row: null,
          ...(part !== "mark" && part !== "end" && ink ? textMetrics(element) : {}),
        },
      ];
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
        endEdge: (read.bar ? read.bar.getBoundingClientRect().right : contentEnd(row)) + scrollX,
        flow: `${read.groupId}.${flows.indexOf(unit.parentElement)}`,
        gapBefore: unit.parentElement ? flowGap(unit.parentElement) : 0,
        group: read.groupId,
        id: rowId,
        ink: rowInk ? bounds(rowInk) : null,
        margins: [margin("marginTop"), margin("marginBottom")],
        middle: rowMiddle(row, read.piece.group) + scrollY,
        name: name(row),
        note: note ? [...row.querySelectorAll(note)].some((element) => shown(element)) : false,
        // The row the learner is on (current, picked, highlighted) may set its words apart.
        ...(row.matches("[aria-current], [data-highlighted], [aria-selected=true]") ||
        row.querySelector("[aria-current]")
          ? { current: true }
          : {}),
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

  /**
   * A cell of a grid laid out in two columns or more with something beside it: a side column
   * beside a hero or a list. A lone cell in such a grid (#13's "More") leaves the rest empty, so
   * it isn't a column of its own.
   */
  function isGridCell(element: Element) {
    const parent = element.parentElement;

    if (!parent || isContents(element) || !getComputedStyle(parent).display.endsWith("grid")) {
      return false;
    }

    const box = element.getBoundingClientRect();

    return (
      getComputedStyle(parent).gridTemplateColumns.trim().split(/\s+/u).length > 1 &&
      [...parent.children].some((other) => {
        const beside = other.getBoundingClientRect();

        return (
          other !== element && shown(other) && beside.top < box.bottom && box.top < beside.bottom
        );
      })
    );
  }

  /**
   * The closest column an element sits in, past columns that draw no box of their own: a declared
   * one, or a grid's cell where a grid splits the page (the course page's plan beside its hero,
   * the catalog's courses beside their categories), which craft calls a column of its own.
   */
  function columnOf(element: Element) {
    let column = element.parentElement?.closest(columns) ?? null;

    while (column && isContents(column)) {
      column = column.parentElement?.closest(columns) ?? null;
    }

    // A cell holds what it lays out; what is positioned (the course page's route rail) is drawn
    // on the page, so it keeps the page's column.
    if (["absolute", "fixed"].includes(getComputedStyle(element).position)) {
      return column;
    }

    for (let cell = element.parentElement; cell && cell !== column; cell = cell.parentElement) {
      if (isGridCell(cell) && (!column || column.contains(cell))) {
        return cell;
      }
    }

    return column;
  }

  // A measure is rems and pixels, so one value draws one width wherever it's set.
  const measured = new Map<string, number | null>();

  /**
   * The width a page gives its content (`--page-measure`, a form's or a list and its pane's) at
   * `container`, or null where it sets none: a length as written, else as a hidden box draws it.
   */
  function measureOf(container: Element) {
    const value = getComputedStyle(container).getPropertyValue("--page-measure").trim();

    if (!value) {
      return null;
    }

    const length = /^(?<px>\d+(?:\.\d+)?)px$/u.exec(value)?.groups?.px;

    if (length) {
      return Number(length);
    }

    if (!measured.has(value)) {
      const ruler = document.createElement("div");

      ruler.style.cssText =
        "position:absolute;visibility:hidden;height:0;width:var(--page-measure)";

      container.append(ruler);
      const { width } = ruler.getBoundingClientRect();
      ruler.remove();
      measured.set(value, width > 0 ? width : null);
    }

    return measured.get(value) ?? null;
  }

  /**
   * A column's content edges, and its frame with the gutter. The end is the column's padding box,
   * or the page's measure where one is set over `element` (a page may set it below the column).
   */
  function edgesOf(column: Element, element: Element) {
    const frame = column.getBoundingClientRect();
    const style = getComputedStyle(column);
    const { pixels } = globalThis.zoonkPage;
    const left = frame.left + pixels(style.paddingLeft);
    const right = frame.right - pixels(style.paddingRight);
    const measure = measureOf(element.parentElement ?? column);

    return { frame, left, right: measure === null ? right : Math.min(right, left + measure) };
  }

  const declaredGroups = pieces.map(({ web: piece }) => piece.group).join(", ");

  /** A group no other declared group holds starts and ends on its column's edges (`spanLeads`). */
  function columnFields(group: Element): Pick<CaptureElement, "column" | "frame"> {
    const column = group.parentElement?.closest(declaredGroups) ? null : columnOf(group);

    if (!column) {
      return {};
    }

    const edges = edgesOf(column, group);

    return {
      column: [edges.left + scrollX, edges.right + scrollX],
      frame: [edges.frame.left + scrollX, edges.frame.right + scrollX],
    };
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
      (row) =>
        present(row) &&
        !candidates.some((other) => other !== row && other.contains(row)) &&
        (!piece.words || firstText(row) !== null),
    );

    if (piece.words && rows.length === 0) {
      return [];
    }

    const bar = piece.bar ? group.querySelector(piece.bar) : null;
    const groupInk = inkOf(group);
    const read = { bar, group, groupId, piece, pieceName, rows };
    const flows = [...new Set(rows.map((row) => unitIn(row, group).parentElement))];
    const drawnBox = group.getBoundingClientRect();

    // Layout sizes are whole pixels, so a drawn size more than one off is a transform or a zoom.
    const scaled =
      group instanceof HTMLElement &&
      !isContents(group) &&
      ((group.offsetWidth > 0 && Math.abs(drawnBox.width - group.offsetWidth) > 1) ||
        (group.offsetHeight > 0 && Math.abs(drawnBox.height - group.offsetHeight) > 1));

    return [
      {
        bounds: bounds(boxOf(group)),
        ...(scaled
          ? { layoutScale: Math.round((drawnBox.width / group.offsetWidth) * 100) / 100 }
          : {}),
        ...(isRtl(group) ? { direction: "rtl" as const } : {}),
        ...columnFields(group),
        endEdge: (bar ? bar.getBoundingClientRect().right : contentEnd(group)) + scrollX,
        group: null,
        id: groupId,
        ink: groupInk ? bounds(groupInk) : null,
        name: name(group.getAttribute("aria-label") ? group : (rows[0] ?? group)),
        part: "group",
        piece: pieceName,
        row: null,
      },
      ...groupParts(read),
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

  /**
   * Every drawn box that passes its column (craft E7): a row's highlight (its `::before` fill, or a
   * fill on a current or highlighted row), a hairline, a picture, or any other box, with the
   * column's content edges and its frame (the column with its gutter). The closest column that
   * draws a box is the box's own; the bottom bar reaches the frame by design and isn't read.
   */
  function readBleeds(): CaptureElement[] {
    const PAST = 1;
    const HAIRLINE = 2;
    const { pixels } = globalThis.zoonkPage;

    const beforeFill = (element: Element): Rect | null => {
      const pseudo = getComputedStyle(element, "::before");

      if (
        pseudo.content === "none" ||
        pseudo.position !== "absolute" ||
        globalThis.zoonkPage.rgba(pseudo.backgroundColor)[3] === 0
      ) {
        return null;
      }

      const box = element.getBoundingClientRect();

      return {
        bottom: box.bottom - pixels(pseudo.bottom),
        left: box.left + pixels(pseudo.left),
        right: box.right - pixels(pseudo.right),
        top: box.top + pixels(pseudo.top),
      };
    };

    /** A border on the top or the bottom alone: a rule drawn across the element at that edge. */
    const ruleOf = (element: Element): Rect | null => {
      const style = getComputedStyle(element);

      const drawn = (side: string) =>
        pixels(style.getPropertyValue(`border-${side}-width`)) > 0 &&
        globalThis.zoonkPage.rgba(style.getPropertyValue(`border-${side}-color`))[3] > 0;

      // A rule on the top or the bottom alone, whatever the sides draw: a grid's middle tile draws
      // its dividers too, and its part of the row's hairline is still that hairline.
      if (drawn("top") === drawn("bottom")) {
        return null;
      }

      const box = element.getBoundingClientRect();

      const width = pixels(
        style.getPropertyValue(drawn("top") ? "border-top-width" : "border-bottom-width"),
      );

      return drawn("top")
        ? { bottom: box.top + width, left: box.left, right: box.right, top: box.top }
        : { bottom: box.bottom, left: box.left, right: box.right, top: box.bottom - width };
    };

    type Kind = NonNullable<CaptureElement["kind"]>;

    const kindOf = (element: Element, box: Rect): Kind => {
      if (element.matches("img, video, canvas, picture")) {
        return "picture";
      }

      return Math.min(box.right - box.left, box.bottom - box.top) <= HAIRLINE ? "hairline" : "box";
    };

    const read = [...document.querySelectorAll(`:is(${columns}) *`)].flatMap(
      (element, index): { fill: CaptureElement; passing: boolean }[] => {
        const column = columnOf(element);

        if (!column || !shown(element) || element.closest("[data-slot=bottom-bar]")) {
          return [];
        }

        const edges = edgesOf(column, element);

        const passes = (box: Rect) =>
          edges.left - box.left > PAST || box.right - edges.right > PAST;

        const highlight = beforeFill(element);

        const ownBox = globalThis.zoonkPage.paints(element, ["top", "right", "bottom", "left"])
          ? element.getBoundingClientRect()
          : null;

        const line = ownBox ? null : ruleOf(element);
        const current = element.matches("[aria-current], [data-highlighted], [aria-selected=true]");

        const lit: Kind = element.closest("[role=tablist], [data-slot=tabs-list], [data-tabs]")
          ? "tab"
          : "highlight";

        // Every rule, passing or not: a line is judged whole, so a part inside the column that
        // touches one passing it (a grid's middle tile) is part of that line.
        const found: { box: Rect; kind: Kind; passing: boolean }[] = [
          ...(highlight && passes(highlight) ? [{ box: highlight, kind: lit, passing: true }] : []),
          ...(ownBox && passes(ownBox)
            ? [{ box: ownBox, kind: current ? lit : kindOf(element, ownBox), passing: true }]
            : []),
          ...(line ? [{ box: line, kind: "hairline" as const, passing: passes(line) }] : []),
        ];

        return found.map(({ box, kind, passing }, part) => ({
          fill: {
            bounds: bounds(box),
            column: [edges.left + scrollX, edges.right + scrollX],
            frame: [edges.frame.left + scrollX, edges.frame.right + scrollX],
            group: null,
            id: `fill.${index}.${part}`,
            ink: bounds(box),
            kind,
            name: name(element),
            part: "fill",
            piece: "page",
            row: null,
          },
          passing,
        }));
      },
    );

    const kept = read.filter(({ passing }) => passing).map(({ fill }) => fill);
    let rest = read.filter(({ passing }) => !passing).map(({ fill }) => fill);

    const touches = (one: CaptureElement, other: CaptureElement) =>
      Math.abs(one.bounds[1] - other.bounds[1]) <= PAST &&
      one.bounds[0] <= other.bounds[0] + other.bounds[2] + PAST &&
      other.bounds[0] <= one.bounds[0] + one.bounds[2] + PAST;

    for (let joined = true; joined;) {
      const joining = rest.filter((line) =>
        kept.some((fill) => fill.kind === "hairline" && touches(fill, line)),
      );

      joined = joining.length > 0;
      kept.push(...joining);
      rest = rest.filter((line) => !joining.includes(line));
    }

    return kept;
  }

  const covers = [...document.querySelectorAll(surfaces)].filter((surface) => present(surface));
  const surfaceName = (cover: Element) => `${name(cover)} #${covers.indexOf(cover) + 1}`;

  const shows = (cover: Element, x: number, y: number) => {
    const hit = document.elementFromPoint(x, y);
    return hit !== null && cover.contains(hit);
  };

  /** The surface on top: the one whose own middle the document hits inside it, not the last in order. */
  const exposed = covers.filter((cover) => {
    const box = boxOf(cover);
    return shows(cover, (box.left + box.right) / 2, (box.top + box.bottom) / 2);
  });

  /**
   * Of two surfaces that partly overlap, the declared surface the document shows where they overlap
   * (a third one over both, such as a dialog over a sheet over the page's bar, included); one inside
   * the other is the inner one. Null when the document shows no declared surface there.
   */
  const upper = (one: Element, other: Element): Element | null => {
    if (one.contains(other) || other.contains(one)) {
      return one.contains(other) ? other : one;
    }

    const a = boxOf(one);
    const b = boxOf(other);
    const left = Math.max(a.left, b.left);
    const right = Math.min(a.right, b.right);
    const top = Math.max(a.top, b.top);
    const bottom = Math.min(a.bottom, b.bottom);

    if (left >= right || top >= bottom) {
      return one;
    }

    const hit = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);
    return (hit && covers.findLast((cover) => cover.contains(hit))) ?? null;
  };

  const top = covers.reduce<Element | null | undefined>(
    (current, cover) => (current && cover !== current ? upper(current, cover) : current),
    exposed.at(-1) ?? covers.at(-1),
  );

  const surfaceOf = (element: Element) => {
    const cover = covers.findLast((surface) => surface.contains(element));
    return cover ? surfaceName(cover) : "page";
  };

  const filled = (control: Element) =>
    getComputedStyle(control).getPropertyValue("--button-variant").trim() === "default";

  const actions = [...document.querySelectorAll(controls)]
    .filter((action) => filled(action) && present(action))
    .map((action, index): CaptureElement => {
      // A link's destination, or the action a piece names on its button (`data-action-name`): the
      // same words to the same place offered twice (a page's goal box at its top and its end) are
      // one action. A form's URL doesn't say that: every Server Action form gets the same one.
      const declared = action instanceof HTMLElement ? action.dataset.actionName : undefined;
      const named = declared ? `action:${declared}` : null;
      const target = action instanceof HTMLAnchorElement ? action.href : named;

      return {
        bounds: bounds(boxOf(action)),
        group: null,
        id: `action.${index}`,
        ink: bounds(boxOf(action)),
        name: name(action),
        part: "action",
        piece: "action",
        row: null,
        ...(action.matches(":disabled, [aria-disabled=true]") ? { disabled: true } : {}),
        surface: surfaceOf(action),
        text: globalThis.zoonkPage.label(action),
        ...(target ? { target } : {}),
        variant: "filled",
      };
    });

  const anchored = anchors.flatMap(({ id, web }): CaptureElement[] => {
    const element = [...document.querySelectorAll(web)].find((candidate) => present(candidate));

    if (!element) {
      return [];
    }

    const ink = inkOf(element);

    return [
      {
        anchor: id,
        bounds: bounds(boxOf(element)),
        group: null,
        id: `anchor.${id}`,
        ink: ink ? bounds(ink) : null,
        name: name(element),
        part: "anchor",
        piece: "",
        row: null,
      },
    ];
  });

  // Only at the scroll's end can the page be judged for what it leaves under a pinned bar.
  const atEnd = scrollY + innerHeight >= document.documentElement.scrollHeight - 1;

  const pinned = (atEnd ? [...document.querySelectorAll(pinnedBars)] : [])
    .filter((bar) => present(bar) && ["fixed", "sticky"].includes(getComputedStyle(bar).position))
    .map((bar, index): CaptureElement => ({
      bounds: bounds(boxOf(bar)),
      group: null,
      id: `pinned.${index}`,
      ink: null,
      name: name(bar),
      part: "pinned",
      piece: "page",
      row: null,
    }));

  const all = [...elements, ...actions, ...anchored, ...pinned, ...readBleeds()];

  // Null when two surfaces overlap and the document shows no declared surface where they do.
  if (top === null) {
    return { activeSurface: "not measured", elements: all };
  }

  return { activeSurface: top ? surfaceName(top) : "page", elements: all };
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
  textScale = 1,
  viewport,
}: {
  page: AlignmentPage;
  path: string;
  scheme: Scheme;
  textScale?: number;
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
      textScale,
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
