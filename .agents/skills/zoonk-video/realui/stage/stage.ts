import { ZoonkLogo } from "@repo/packages/ui/src/components/zoonk-logo.tsx";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { type Lang } from "../story";
import { EASE, type Fade, type Piece, type PieceSpec, type Rect, Timeline, makePiece } from "./kit";

export type Format = "16x9" | "4x5";

export const FORMATS: Record<Format, { w: number; h: number }> = {
  "16x9": { w: 1920, h: 1080 },
  "4x5": { w: 1080, h: 1350 },
};

type Point = { x: number; y: number };
/** A side of the frame: the frame coordinate it bounds, and where. */
type Edge = { axis: "x" | "y"; at: number; name: string };

export type Stage = {
  fmt: Format;
  /** The 16:9 frame takes the app's wide layout; the portrait ones its phone layout. */
  wide: boolean;
  size: { w: number; h: number };
  lang: Lang;
  tl: Timeline;
  world: HTMLDivElement;
  piece: (spec: PieceSpec) => Promise<Piece>;
  /** Where the one light on the ground sits, in % of the frame. */
  light: (x: number, y: number) => void;
  /** A finger on what is about to be pressed, centered on a point of the world. */
  touch: (x: number, y: number, size: number) => HTMLDivElement;
  /**
   * A layer behind the focus leaves the frame through a fade, so the bleed reads as depth, not a
   * crop. It starts fading at `start` (a share of the frame's height or width) and is gone just
   * before that edge, however long its words run.
   */
  fade: (piece: Piece, to: Fade["to"], start: number) => void;
  /** For a moving shot: whatever the camera carries past an edge dissolves into the ground on the way. */
  edges: () => void;
  /** The bolder variant: the whole stage seen from an angle, with the layers behind out of focus. */
  tilt: (behind: Piece[]) => void;
  /** A clip that loops opens on the mark with zoonk.com, which gives way to the shot by `until`. */
  open: (until: number) => void;
  /** The last shot: the ground covers everything and the mark comes up with zoonk.com. */
  end: (at: number, until: number) => void;
  /** Shows the moment at t, every piece cropped to its elements as they are then. */
  seek: (t: number) => void;
  /**
   * What the frame cuts at this moment: words or buttons sliced by a piece's crop, and any piece
   * that meets an edge of the frame while still visible there.
   */
  cuts: () => string[];
};

export type Scene = (stage: Stage) => Promise<void>;

/** The most a run of words may show where an edge slices it: a layer leaves through its fade, not a crop. */
const VISIBLE_AT_CUT = 0.12;
/** Where a fade ends, as a share of the frame: just before the edge, so nothing visible reaches it. */
const FADE_END = 0.985;
/** How far back the check looks to tell whether the camera is moving, in seconds. */
const MOTION_STEP = 1 / 20;
/** Below this speed, in frame px a second, the shot counts as settled: the slow drift of a resting camera. */
const SETTLED = 60;
/** How many lines across a piece are followed to where it meets an edge. */
const LINES = 24;
/** How wide the band is in which a moving shot dissolves into the ground, as a share of the frame's short side. */
const EDGE_BAND = 0.07;

/** The world's transform with its origin, as a matrix from world px to frame px. */
function worldMatrix(world: HTMLElement) {
  const style = getComputedStyle(world);
  const [ox = 0, oy = 0] = style.transformOrigin.split(" ").map(Number.parseFloat);
  const own = style.transform === "none" ? new DOMMatrix() : new DOMMatrix(style.transform);
  return new DOMMatrix().translate(ox, oy).multiply(own).translate(-ox, -oy);
}

/** How opaque a piece's own fade leaves a point of it, from 0 to 1. */
function faded(piece: Piece, x: number, y: number) {
  if (!piece.fade) return 1;
  const { from, to, until } = piece.fade;
  const at = to === "bottom" ? y : x;
  return Math.min(1, Math.max(0, (until - at) / (until - from)));
}

export function createStage({
  fmt,
  lang,
  frame,
}: {
  fmt: Format;
  lang: Lang;
  frame: HTMLDivElement;
}): Stage {
  const size = FORMATS[fmt];
  const world = frame.querySelector<HTMLDivElement>("#world") as HTMLDivElement;
  const view = frame.querySelector<HTMLDivElement>("#view") as HTMLDivElement;
  const cover = frame.querySelector<HTMLElement>("#cover") as HTMLElement;
  const mark = frame.querySelector<HTMLElement>("#end") as HTMLElement;
  const tl = new Timeline();
  const pieces: Piece[] = [];
  const fades = new Map<Piece, { start: number; to: Fade["to"] }>();
  let band = 0;
  let now = 0;

  // The cover and the mark: one set of tracks, so a clip can open on the mark and end on it.
  const covered = tl.track(0);
  const shown = tl.track(0);
  const markScale = tl.track(1);
  let marked = false;
  const useMark = () => {
    if (marked) return;
    marked = true;
    mark.innerHTML = `${renderToStaticMarkup(createElement(ZoonkLogo))}<span>zoonk.com</span>`;
    mark.style.fontSize = `${Math.round(size.w * 0.069)}px`;
    tl.each((t) => {
      cover.style.opacity = String(covered.at(t));
      mark.style.opacity = String(shown.at(t));
      mark.style.transform = `scale(${markScale.at(t)})`;
    });
  };

  const toFrame = (matrix: DOMMatrix, piece: Piece, x: number, y: number): Point => {
    const { s, x: px, y: py } = piece.state;
    const at = matrix.transformPoint(new DOMPoint(px + x * s, py + y * s));
    return { x: at.x / at.w, y: at.y / at.w };
  };

  /** Each fade's stops in its piece's px, found where the piece meets the frame now. */
  function placeFades(matrix: DOMMatrix) {
    for (const [piece, { start, to }] of fades) {
      const across = to === "bottom" ? piece.w : piece.h;
      const reach = (local: number) =>
        Math.max(
          ...[0, across].map((side) => {
            const at =
              to === "bottom"
                ? toFrame(matrix, piece, side, local)
                : toFrame(matrix, piece, local, side);
            return to === "bottom" ? at.y : at.x;
          }),
        );
      const extent = to === "bottom" ? size.h : size.w;
      const along = to === "bottom" ? piece.h : piece.w;
      // Within the piece and a frame beyond it: far past that, perspective folds points behind the eye.
      const localAt = (target: number) => {
        let low = -along - extent / piece.state.s;
        let high = along + extent / piece.state.s;
        for (let step = 0; step < 50; step++) {
          const mid = (low + high) / 2;
          if (reach(mid) < target) low = mid;
          else high = mid;
        }
        return low;
      };
      const from = localAt(start * extent);
      const until = Math.max(from + 1, localAt(FADE_END * extent));
      piece.fade = { from, to, until };
      piece.el.style.maskImage = `linear-gradient(to ${to}, #000 ${from}px, transparent ${until}px)`;
    }
  }

  /**
   * How visible what a piece shows is where it meets an edge, from 0 to 1, or null when it doesn't
   * meet it. Lines across it are followed to the point where each crosses the edge; the most visible one counts.
   */
  function atEdge(matrix: DOMMatrix, piece: Piece, shown: Rect, edge: Edge) {
    const [from, along] = edge.axis === "y" ? [shown.y, shown.h] : [shown.x, shown.w];
    const [start, across] = edge.axis === "y" ? [shown.x, shown.w] : [shown.y, shown.h];
    const local = (line: number, at: number) => (edge.axis === "y" ? [line, at] : [at, line]);
    const past = (line: number, at: number) => {
      const [x = 0, y = 0] = local(line, at);
      return toFrame(matrix, piece, x, y)[edge.axis] - edge.at;
    };
    let most: number | null = null;
    for (let i = 0; i <= LINES; i++) {
      const line = start + (across * i) / LINES;
      let low = from;
      let high = from + along;
      if (Math.sign(past(line, low)) === Math.sign(past(line, high))) continue;
      const rising = past(line, low) < 0;
      for (let step = 0; step < 30; step++) {
        const mid = (low + high) / 2;
        if (past(line, mid) < 0 === rising) low = mid;
        else high = mid;
      }
      const [x = 0, y = 0] = local(line, low);
      most = Math.max(most ?? 0, piece.state.o * faded(piece, x, y));
    }
    return most;
  }

  /** How fast the camera carries the world past the frame now, in frame px a second. */
  function travel(matrix: DOMMatrix) {
    tl.seek(now - MOTION_STEP);
    const before = worldMatrix(world);
    tl.seek(now);
    const back = matrix.inverse();
    const corners = [
      [0, 0],
      [size.w, 0],
      [0, size.h],
      [size.w, size.h],
    ] as const;
    return Math.max(
      ...corners.map(([x, y]) => {
        const at = before.transformPoint(back.transformPoint(new DOMPoint(x, y)));
        return Math.hypot(at.x / at.w - x, at.y / at.w - y) / MOTION_STEP;
      }),
    );
  }

  /** The edges a piece may meet only through its own fade, now. */
  function guarded(matrix: DOMMatrix): Edge[] {
    // A still: every side of the frame.
    if (band === 0)
      return [
        { at: 0, axis: "y", name: "top" },
        { at: size.w, axis: "x", name: "right" },
        { at: size.h, axis: "y", name: "bottom" },
        { at: 0, axis: "x", name: "left" },
      ];
    // A moving shot carries things out through the top and bottom, where they dissolve (edges()). Its
    // sides are for a pan only: once the camera settles, nothing sits in their dissolve.
    if (now >= MOTION_STEP && travel(matrix) >= SETTLED) return [];
    return [
      { at: size.w - band, axis: "x", name: "right" },
      { at: band, axis: "x", name: "left" },
    ];
  }

  function cuts() {
    const matrix = worldMatrix(world);
    const edges = guarded(matrix);

    return pieces.flatMap((piece) => {
      if (piece.state.o < 0.01) return [];
      const found = piece.ink().flatMap((ink) => {
        const corners = [
          [ink.x, ink.y],
          [ink.x + ink.w, ink.y],
          [ink.x, ink.y + ink.h],
          [ink.x + ink.w, ink.y + ink.h],
        ] as const;
        const seen = corners.filter(
          ([x, y]) => x >= -0.5 && y >= -0.5 && x <= piece.w + 0.5 && y <= piece.h + 0.5,
        );
        const shows = piece.state.o * Math.max(0, ...seen.map(([x, y]) => faded(piece, x, y)));
        return seen.length > 0 && seen.length < 4 && shows > VISIBLE_AT_CUT
          ? [`${piece.name}: its crop cuts through "${ink.text}"`]
          : [];
      });
      const shown = piece.drawn();
      if (!shown) return found;
      for (const edge of edges) {
        const shows = atEdge(matrix, piece, shown, edge);
        if (shows !== null && shows > VISIBLE_AT_CUT)
          found.push(
            `${piece.name}: meets the ${edge.name} edge at ${Math.round(shows * 100)}% opacity; keep it inside the frame or fade it out toward that edge (stage.fade)`,
          );
      }
      return found;
    });
  }

  return {
    fmt,
    wide: fmt === "16x9",
    size,
    lang,
    tl,
    world,
    async piece(spec) {
      const made = await makePiece(world, spec);
      pieces.push(made);
      return made;
    },
    light(x, y) {
      frame.style.setProperty("--light-x", `${x}%`);
      frame.style.setProperty("--light-y", `${y}%`);
    },
    touch(x, y, diameter) {
      const dot = document.createElement("div");
      dot.className = "touch";
      Object.assign(dot.style, {
        width: `${diameter}px`,
        height: `${diameter}px`,
        transform: `translate(${x - diameter / 2}px, ${y - diameter / 2}px)`,
      });
      world.append(dot);
      return dot;
    },
    fade(piece, to, start) {
      fades.set(piece, { start, to });
    },
    edges() {
      band = Math.round(Math.min(size.w, size.h) * EDGE_BAND);
      const along = (to: string) =>
        `linear-gradient(to ${to}, transparent, #000 ${band}px, #000 calc(100% - ${band}px), transparent)`;
      view.style.maskImage = `${along("bottom")}, ${along("right")}`;
      view.style.maskComposite = "intersect";
    },
    tilt(behind) {
      for (const piece of behind) piece.el.style.filter = "blur(2.5px)";
      Object.assign(world.style, {
        width: `${size.w}px`,
        height: `${size.h}px`,
        transformOrigin: "50% 42%",
        transform:
          fmt === "16x9"
            ? "perspective(2600px) translate3d(-70px, 24px, 0) rotateX(16deg) rotateY(-20deg) rotateZ(4deg) scale(0.94)"
            : "perspective(2600px) translate3d(-30px, 0, 0) rotateX(14deg) rotateY(-16deg) rotateZ(3deg) scale(0.92)",
      });
    },
    open(until) {
      useMark();
      // The first frame is the last one: the ground, and the mark at the size end() leaves it.
      covered.set(0, 1).to(until - 0.55, 0.55, 0, EASE.swing);
      shown.set(0, 1).to(until - 0.85, 0.45, 0, EASE.out);
      markScale.set(0, 1.02).to(0, until - 0.45, 1.035, EASE.linear);
    },
    end(at, until) {
      useMark();
      covered.to(at, 0.55, 1, EASE.swing);
      shown.to(at + 0.4, 0.7, 1, EASE.out);
      markScale
        .set(at + 0.4, 0.965)
        .to(at + 0.4, 1.1, 1, EASE.out)
        .to(at + 1.5, until - at - 1.5, 1.02, EASE.linear);
      tl.duration = until;
    },
    seek(t) {
      now = t;
      tl.seek(t);
      for (const piece of pieces) piece.fit();
      placeFades(worldMatrix(world));
    },
    cuts,
  };
}
