import { ZoonkLogo } from "@repo/packages/ui/src/components/zoonk-logo.tsx";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { type Lang } from "../story";
import { EASE, type Piece, type PieceSpec, Timeline, makePiece } from "./kit";

export type Format = "16x9" | "4x5";

export const FORMATS: Record<Format, { w: number; h: number }> = {
  "16x9": { w: 1920, h: 1080 },
  "4x5": { w: 1080, h: 1350 },
};

export type Stage = {
  fmt: Format;
  /** The 16:9 frame takes the app's wide layout; the 4:5 one its phone layout. */
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
  /** A layer behind the focus leaves the frame through a fade, so the bleed reads as depth, not a crop. */
  fade: (piece: Piece, to: "bottom" | "right", from: number, until: number) => void;
  /** The bolder variant: the whole stage seen from an angle, with the layers behind out of focus. */
  tilt: (behind: Piece[]) => void;
  /** The last shot: the ground covers everything and the mark comes up with zoonk.com. */
  end: (at: number, until: number) => void;
};

export type Scene = (stage: Stage) => Promise<void>;

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
  const tl = new Timeline();
  return {
    fmt,
    wide: fmt === "16x9",
    size,
    lang,
    tl,
    world,
    piece: (spec) => makePiece(world, spec),
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
    fade(piece, to, from, until) {
      piece.el.style.maskImage = `linear-gradient(to ${to}, #000 ${from}%, transparent ${until}%)`;
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
    end(at, until) {
      const cover = frame.querySelector<HTMLElement>("#cover") as HTMLElement;
      const mark = frame.querySelector<HTMLElement>("#end") as HTMLElement;
      mark.innerHTML = `${renderToStaticMarkup(createElement(ZoonkLogo))}<span>zoonk.com</span>`;
      mark.style.fontSize = `${Math.round(size.w * 0.069)}px`;
      const covered = tl.track(0).to(at, 0.55, 1, EASE.swing);
      const shown = tl.track(0).to(at + 0.4, 0.7, 1, EASE.out);
      const scale = tl
        .track(0.965)
        .to(at + 0.4, 1.1, 1, EASE.out)
        .to(at + 1.5, until - at - 1.5, 1.02, EASE.linear);
      tl.each((t) => {
        cover.style.opacity = String(covered.at(t));
        mark.style.opacity = String(shown.at(t));
        mark.style.transform = `scale(${scale.at(t)})`;
      });
      tl.duration = until;
    },
  };
}
