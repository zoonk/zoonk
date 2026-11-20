// The stage: real components lifted out of real screens and placed on a canvas one by one. A piece is
// a same-origin iframe of a harness view at a chosen width, clipped to one element's own box, so it
// keeps the layout the app gives it at that width and stays live DOM: sharp at any scale, and its
// inner elements can move on their own. Nothing is redrawn.

export type Rect = { x: number; y: number; w: number; h: number };
type Edges = [top: number, right: number, bottom: number, left: number];

export type PieceSpec = {
  /** Harness query, such as "view=learner-goal&learner=madrid&lang=en". */
  view: string;
  /** The iframe's viewport: the width picks the layout the app gives the component. */
  w: number;
  h?: number;
  /** Selectors whose union is the piece's box. */
  crop: string[];
  /** Room around the box, in the view's px. */
  pad?: Edges;
  /** Selectors hidden inside the piece; they keep their space. */
  hide?: string[];
  /** Waited for before measuring; the first crop selector by default. */
  wait?: string;
  css?: string;
  /** The lift shadow under a surface that sits above the ground. */
  lift?: boolean;
  /** The clip's corner radius in the view's px; the crop element's own by default. */
  radius?: number;
};

export type Placement = { x: number; y: number; s: number; o: number };

/** A layer that leaves the frame through a fade: opaque until `from`, gone at `until`, in its px along `to`. */
export type Fade = { to: "bottom" | "right"; from: number; until: number };

/** A run of words or a drawn control, in the piece's px, and what it says. */
export type Ink = Rect & { text: string };

export type Piece = {
  name: string;
  el: HTMLDivElement;
  doc: Document;
  win: typeof window;
  /** The crop's size now, in the view's px. */
  w: number;
  h: number;
  /** A descendant's box relative to the piece's origin, in the view's px. */
  rect: (target: string | Element) => Rect;
  /** The first visible match; throws when there is none. */
  q: <T extends Element = HTMLElement>(selector: string) => T;
  all: <T extends Element = HTMLElement>(selector: string) => T[];
  /** Every visible run of words and every drawn button in the view, wherever it sits against the crop. */
  ink: () => Ink[];
  /** How far right its words and controls reach, in the view's px: text wraps inside boxes wider than it. */
  inkWidth: () => number;
  /** The box around everything it shows inside its crop (words, fills, edges, icons), or null when it shows nothing. */
  drawn: () => Rect | null;
  /** Crops to its elements as they are now: a field that grew to two lines shows both. */
  fit: () => void;
  place: (to: Partial<Placement>) => void;
  state: Placement;
  fade: Fade | null;
};

const BASE_CSS = `
  html, body { background: transparent !important; overflow: hidden !important; }
  *, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; }
  [data-slot="learn-shell"], [data-slot="page-top-bar"], [data-slot="bottom-bar"] { background: transparent !important; }
  ::-webkit-scrollbar { display: none; }
`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const isShown = (node: Element) => node.getBoundingClientRect().width > 0;

async function load(frame: HTMLIFrameElement, spec: PieceSpec): Promise<Document> {
  await new Promise<void>((resolve) => {
    frame.addEventListener("load", () => resolve(), { once: true });
    frame.src = `/?${spec.view}`;
  });
  const doc = frame.contentDocument as Document;
  const waitFor = spec.wait ?? spec.crop[0] ?? "body";
  for (let tries = 0; tries < 200 && !doc.querySelector(waitFor); tries++) await sleep(50);
  if (!doc.querySelector(waitFor)) throw new Error(`${spec.view}: ${waitFor} never rendered`);
  const style = doc.createElement("style");
  const hide = spec.hide?.length ? `${spec.hide.join(",")} { visibility: hidden !important; }` : "";
  style.textContent = BASE_CSS + hide + (spec.css ?? "");
  doc.head.append(style);
  await doc.fonts.ready;
  await sleep(250);
  return doc;
}

/** The union of the crop's visible boxes, in the iframe's px. A copy the layout hides at this width has an empty box. */
function cropBox(doc: Document, spec: PieceSpec) {
  const boxes = spec.crop
    .flatMap((selector) =>
      [...doc.querySelectorAll(selector)].map((node) => node.getBoundingClientRect()),
    )
    .filter((box) => box.width > 0 && box.height > 0);
  if (boxes.length === 0)
    throw new Error(`${spec.view}: nothing visible for ${spec.crop.join(", ")}`);
  const [top, right, bottom, left] = spec.pad ?? [0, 0, 0, 0];
  const x = Math.min(...boxes.map((box) => box.left)) - left;
  const y = Math.min(...boxes.map((box) => box.top)) - top;
  return {
    x,
    y,
    w: Math.max(...boxes.map((box) => box.right)) + right - x,
    h: Math.max(...boxes.map((box) => box.bottom)) + bottom - y,
  };
}

/** The box the nearest clipping ancestor leaves visible, so truncated words count only as far as they show. */
function visibleBox(win: typeof window, node: Element): DOMRect | null {
  for (let at: Element | null = node; at; at = at.parentElement) {
    const style = win.getComputedStyle(at);
    if (style.overflowX !== "visible" || style.overflowY !== "visible")
      return at.getBoundingClientRect();
  }
  return null;
}

const shows = (node: Element) =>
  node.checkVisibility({ opacityProperty: true, visibilityProperty: true });

/** Every visible run of words, and every button with its own fill or edge, in the view's px. */
function inkIn(doc: Document, win: typeof window): (DOMRect & { text: string })[] {
  const range = doc.createRange();
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const found: (DOMRect & { text: string })[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    const text = node.textContent?.trim();
    if (!parent || !text || !shows(parent)) continue;
    const clip = visibleBox(win, parent);
    // A run's rect is the font's whole content area; its letters stay within the lines' own box.
    const lines = parent.getBoundingClientRect();
    range.selectNodeContents(node);
    for (const at of range.getClientRects()) {
      const left = Math.max(at.left, clip?.left ?? -Infinity);
      const right = Math.min(at.right, clip?.right ?? Infinity);
      const top = Math.max(at.top, lines.top, clip?.top ?? -Infinity);
      const bottom = Math.min(at.bottom, lines.bottom, clip?.bottom ?? Infinity);
      if (right - left > 0.5 && bottom - top > 0.5)
        found.push(Object.assign(new DOMRect(left, top, right - left, bottom - top), { text }));
    }
  }
  // A control's own edge or fill reaches past its words; a bare one (a full-width trigger) is only its words.
  for (const button of doc.querySelectorAll("button")) {
    const style = win.getComputedStyle(button);
    const drawn =
      style.backgroundColor !== "rgba(0, 0, 0, 0)" || Number.parseFloat(style.borderRightWidth) > 0;
    if (drawn && shows(button))
      found.push(
        Object.assign(button.getBoundingClientRect(), {
          text: button.textContent?.trim() || "a button",
        }),
      );
  }
  return found;
}

/** A computed color that shows: not "transparent" and not zero alpha in any color syntax. */
const tinted = (color: string) =>
  color !== "transparent" && !/(?:,\s*0|\/\s*0%?)\)$/.test(color.replaceAll(/\s+/g, " "));

/** Whether an element paints something of its own: a fill, an edge, or a picture. */
function paints(win: typeof window, node: Element) {
  if (node instanceof win.SVGSVGElement || node instanceof win.HTMLImageElement) return true;
  const style = win.getComputedStyle(node);
  if (tinted(style.backgroundColor) || style.backgroundImage !== "none") return true;
  return (["Top", "Right", "Bottom", "Left"] as const).some(
    (side) =>
      Number.parseFloat(style[`border${side}Width`]) > 0 &&
      style[`border${side}Style`] !== "none" &&
      tinted(style[`border${side}Color`]),
  );
}

export async function makePiece(world: HTMLElement, spec: PieceSpec): Promise<Piece> {
  const el = document.createElement("div");
  el.className = `piece${spec.lift ? " lift" : ""}`;
  const clip = document.createElement("div");
  clip.className = "clip";
  const frame = document.createElement("iframe");
  frame.style.width = `${spec.w}px`;
  frame.style.height = `${spec.h ?? 1400}px`;
  frame.setAttribute("scrolling", "no");
  clip.append(frame);
  el.append(clip);
  world.append(el);

  const doc = await load(frame, spec);
  const win = frame.contentWindow as typeof window;
  let box = cropBox(doc, spec);
  const first = [...doc.querySelectorAll(spec.crop[0] ?? "")].find(isShown);
  const radius =
    spec.radius ?? (first ? Number.parseFloat(win.getComputedStyle(first).borderTopLeftRadius) : 0);
  el.style.borderRadius = `${radius}px`;
  clip.style.borderRadius = `${radius}px`;

  const state: Placement = { x: 0, y: 0, s: 1, o: 1 };
  const find = (selector: string) => [...doc.querySelectorAll(selector)].filter(isShown);
  const piece: Piece = {
    name: `${spec.crop[0]} in ${spec.view.replace(/^views=\w+&view=/, "")}`,
    el,
    doc,
    win,
    w: box.w,
    h: box.h,
    rect(target) {
      const node = typeof target === "string" ? find(target)[0] : target;
      if (!node) throw new Error(`${spec.view}: no ${String(target)}`);
      const at = node.getBoundingClientRect();
      return { x: at.left - box.x, y: at.top - box.y, w: at.width, h: at.height };
    },
    q<T extends Element = HTMLElement>(selector: string) {
      const node = find(selector)[0];
      if (!node) throw new Error(`${spec.view}: no ${selector}`);
      return node as T;
    },
    all: <T extends Element = HTMLElement>(selector: string) => find(selector) as T[],
    ink: () =>
      inkIn(doc, win).map((at) => ({
        h: at.height,
        text: at.text,
        w: at.width,
        x: at.left - box.x,
        y: at.top - box.y,
      })),
    inkWidth() {
      const inside = piece.ink().filter((at) => at.x >= 0 && at.y >= 0 && at.y + at.h <= box.h);
      return Math.max(...inside.map((at) => at.x + at.w));
    },
    drawn() {
      const shapes = [...doc.body.querySelectorAll("*")]
        .filter((node) => paints(win, node) && shows(node))
        .map((node) => {
          const at = node.getBoundingClientRect();
          return { h: at.height, w: at.width, x: at.left - box.x, y: at.top - box.y };
        });
      const inside = [...piece.ink(), ...shapes]
        .map((at) => {
          const x = Math.max(0, at.x);
          const y = Math.max(0, at.y);
          return { h: Math.min(box.h, at.y + at.h) - y, w: Math.min(box.w, at.x + at.w) - x, x, y };
        })
        .filter((at) => at.w > 0.5 && at.h > 0.5);
      if (inside.length === 0) return null;
      const x = Math.min(...inside.map((at) => at.x));
      const y = Math.min(...inside.map((at) => at.y));
      return {
        h: Math.max(...inside.map((at) => at.y + at.h)) - y,
        w: Math.max(...inside.map((at) => at.x + at.w)) - x,
        x,
        y,
      };
    },
    fit() {
      box = cropBox(doc, spec);
      piece.w = box.w;
      piece.h = box.h;
      el.style.width = `${box.w}px`;
      el.style.height = `${box.h}px`;
      frame.style.left = `${-box.x}px`;
      frame.style.top = `${-box.y}px`;
    },
    place(to) {
      Object.assign(state, to);
      el.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.s})`;
      el.style.opacity = String(state.o);
    },
    state,
    fade: null,
  };
  piece.fit();
  return piece;
}

/** The box of an element's own digits, without its unit, relative to the piece. */
export function digits(piece: Piece, node: Element): Rect {
  const text = [...node.childNodes].find(
    (child) => child.nodeType === 3 && child.textContent?.trim(),
  );
  if (!text) throw new Error(`no digits in ${node.textContent}`);
  const range = piece.doc.createRange();
  range.selectNodeContents(text);
  const own = range.getBoundingClientRect();
  const base = piece.rect(node);
  const at = node.getBoundingClientRect();
  return {
    x: base.x + own.left - at.left,
    y: base.y + own.top - at.top,
    w: own.width,
    h: own.height,
  };
}

// ---- Easing -------------------------------------------------------------------------------------

function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const fx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const fy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = fx(t) - x;
      const slope = dx(t);
      if (Math.abs(err) < 1e-6 || Math.abs(slope) < 1e-6) break;
      t -= err / slope;
    }
    return fy(t);
  };
}

export const EASE = {
  linear: (x: number) => Math.min(1, Math.max(0, x)),
  /** The app's --ease-out: what arrives and settles. */
  out: bezier(0.22, 1, 0.36, 1),
  /** The camera and carried elements: leaves gently, lands softly, never overshoots. */
  inOut: bezier(0.62, 0, 0.18, 1),
  /** Long drifts that hand over to a move. */
  swing: bezier(0.45, 0, 0.55, 1),
  in: bezier(0.55, 0, 1, 0.45),
};

// ---- Timeline: every value is a pure function of time, so any frame renders on its own -----------

type Tween = { t0: number; t1: number; from: number; to: number; ease: (x: number) => number };

export class Track {
  private tweens: Tween[] = [];
  constructor(private initial: number) {}
  /** Tweens to `to` from wherever the track is at t0. */
  to(t0: number, dur: number, to: number, ease: (x: number) => number = EASE.out) {
    this.tweens.push({ t0, t1: t0 + dur, from: this.at(t0), to, ease });
    this.tweens.sort((a, b) => a.t0 - b.t0);
    return this;
  }
  set(t: number, value: number) {
    return this.to(t, 0, value, EASE.linear);
  }
  at(t: number): number {
    let value = this.initial;
    for (const tween of this.tweens) {
      if (t < tween.t0) break;
      const span = tween.t1 - tween.t0;
      const progress = span <= 0 ? 1 : Math.min(1, (t - tween.t0) / span);
      value = tween.from + (tween.to - tween.from) * tween.ease(progress);
    }
    return value;
  }
}

export class Timeline {
  duration = 0;
  private frames: ((t: number) => void)[] = [];
  track(initial: number) {
    return new Track(initial);
  }
  /** Runs on every seek, in the order added. */
  each(fn: (t: number) => void) {
    this.frames.push(fn);
  }
  seek(t: number) {
    for (const fn of this.frames) fn(t);
  }
}

/** Tracks for a piece's place on the stage. */
export function mover(
  tl: Timeline,
  piece: Piece,
  start: Partial<Placement> & { x: number; y: number },
) {
  const tracks = {
    x: tl.track(start.x),
    y: tl.track(start.y),
    s: tl.track(start.s ?? 1),
    o: tl.track(start.o ?? 1),
  };
  tl.each((t) =>
    piece.place({ x: tracks.x.at(t), y: tracks.y.at(t), s: tracks.s.at(t), o: tracks.o.at(t) }),
  );
  return tracks;
}

/** Opacity and a short rise for elements inside a piece: how every row, line and block arrives. */
export function arrive(
  tl: Timeline,
  nodes: HTMLElement[],
  at: number,
  { stagger = 0.07, dur = 0.6, rise = 10 }: { stagger?: number; dur?: number; rise?: number } = {},
) {
  nodes.forEach((node, index) => {
    const start = at + index * stagger;
    const opacity = tl.track(0).to(start, dur * 0.7, 1, EASE.out);
    const y = tl.track(rise).to(start, dur, 0, EASE.out);
    tl.each((t) => {
      node.style.opacity = String(opacity.at(t));
      node.style.transform = `translateY(${y.at(t)}px)`;
    });
  });
}

/** Fades elements out where they are; for nodes without an arrive() of their own. */
export function leave(tl: Timeline, nodes: HTMLElement[], at: number, dur = 0.3) {
  for (const node of nodes) {
    const opacity = tl.track(1).to(at, dur, 0, EASE.linear);
    tl.each((t) => {
      node.style.opacity = String(opacity.at(t));
    });
  }
}

// ---- Typing in the real field -------------------------------------------------------------------

const noise = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43_758.5453;
  return x - Math.floor(x);
};

/** When each character lands: an even hand, a breath after a word, a beat before a capital and the period. */
export function typingTimes(text: string, start: number, perSecond = 16) {
  const base = 1 / perSecond;
  const gaps = [...text].map((char, i) => {
    if (i === 0) return 0;
    const prev = text[i - 1];
    const wordBreath = prev === " " ? 0.03 : 0;
    const beforeName = prev === " " && /\p{Lu}/u.test(char) ? 0.11 : 0;
    const beforeStop = char === "." ? 0.06 : 0;
    return base * (0.72 + 0.56 * noise(i)) + wordBreath + beforeName + beforeStop;
  });
  return gaps.map((_, i) => start + gaps.slice(0, i + 1).reduce((sum, gap) => sum + gap, 0));
}

export type Field = {
  /** Shows the first n characters, as typing them would. */
  type: (n: number) => void;
  caret: HTMLElement;
  focus: (on: boolean) => void;
};

/** Drives the app's real textarea through React's own input handling, with a caret the stage draws, since a browser's can't be frozen per frame. */
export function field(piece: Piece, selector: string, text: string): Field {
  const area = piece.q<HTMLTextAreaElement>(selector);
  const { doc, win } = piece;
  const setValue = Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype, "value")?.set;
  if (!setValue) throw new Error("no textarea value setter");
  const style = win.getComputedStyle(area);
  const mirror = doc.createElement("div");
  const marker = doc.createElement("span");
  marker.textContent = "​";
  const caret = doc.createElement("div");
  // Everything that decides where the field's lines wrap, so the caret lands where the text ends.
  for (const property of [
    "boxSizing",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "fontFeatureSettings",
    "fontVariationSettings",
    "letterSpacing",
    "wordSpacing",
    "lineHeight",
    "textIndent",
    "textTransform",
    "tabSize",
    "wordBreak",
    "overflowWrap",
    "whiteSpace",
    "textWrapMode",
    "textWrapStyle",
  ] as const)
    mirror.style[property] = style[property];
  Object.assign(mirror.style, { borderStyle: "solid", position: "fixed", visibility: "hidden" });
  Object.assign(caret.style, {
    position: "fixed",
    width: "1.5px",
    background: style.color,
    borderRadius: "1px",
    zIndex: "50",
    pointerEvents: "none",
  });
  doc.body.append(mirror, caret);
  let shown = -1;
  return {
    caret,
    focus(on) {
      if (on && doc.activeElement !== area) area.focus({ preventScroll: true });
      if (!on && doc.activeElement === area) area.blur();
    },
    type(n) {
      if (n !== shown) {
        shown = n;
        setValue.call(area, text.slice(0, n));
        area.dispatchEvent(new win.Event("input", { bubbles: true }));
      }
      const box = area.getBoundingClientRect();
      Object.assign(mirror.style, {
        left: `${box.left}px`,
        top: `${box.top}px`,
        width: `${box.width}px`,
      });
      mirror.textContent = text.slice(0, n);
      mirror.append(marker);
      const at = marker.getBoundingClientRect();
      const size = Number.parseFloat(style.fontSize) * 1.2;
      Object.assign(caret.style, {
        left: `${at.left}px`,
        top: `${at.top + (at.height - size) / 2}px`,
        height: `${size}px`,
      });
    },
  };
}

/** A caret that blinks at a text cursor's 0.53 s while the field is focused and idle, and holds while typing. */
export function blink({
  t,
  focused,
  typingFrom,
  typingTo,
}: {
  t: number;
  focused: [number, number];
  typingFrom: number;
  typingTo: number;
}) {
  if (t < focused[0] || t >= focused[1]) return false;
  if (t >= typingFrom && t <= typingTo) return true;
  const idle = t < typingFrom ? t - focused[0] : t - typingTo;
  return Math.floor(idle / 0.53) % 2 === 0;
}

// ---- Camera -------------------------------------------------------------------------------------

export type Camera = {
  cx: Track;
  cy: Track;
  z: Track;
  zoomTo: (t: number, dur: number, z: number, ease?: (x: number) => number) => void;
};

/** Zoom is a track in log space, so a move feels even from start to end. */
export function camera(
  tl: Timeline,
  world: HTMLElement,
  size: { w: number; h: number },
  start: { cx: number; cy: number; z: number },
): Camera {
  const cx = tl.track(start.cx);
  const cy = tl.track(start.cy);
  const z = tl.track(Math.log(start.z));
  tl.each((t) => {
    const zoom = Math.exp(z.at(t));
    world.style.transform = `translate(${size.w / 2 - cx.at(t) * zoom}px, ${size.h / 2 - cy.at(t) * zoom}px) scale(${zoom})`;
  });
  return {
    cx,
    cy,
    z,
    zoomTo: (t, dur, to, ease = EASE.inOut) => void z.to(t, dur, Math.log(to), ease),
  };
}
