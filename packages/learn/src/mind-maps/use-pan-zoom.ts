"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  DOUBLE_TAP_SCALE,
  FIT,
  type Frame,
  type PanZoom,
  type Point,
  ZOOM_STEP,
  clampPanZoom,
  panBy,
  zoomAt,
} from "./_utils/pan-zoom";

/** A wheel notch of about 100 zooms by about a fifth. */
const WHEEL_ZOOM_SPEED = 0.002;

/** An arrow key moves a zoomed picture this far. */
const ARROW_STEP = 80;

type Pinch = { distance: number; middle: Point; view: PanZoom };

const ARROWS: Readonly<Record<string, Point>> = {
  ArrowDown: { x: 0, y: -ARROW_STEP },
  ArrowLeft: { x: ARROW_STEP, y: 0 },
  ArrowRight: { x: -ARROW_STEP, y: 0 },
  ArrowUp: { x: 0, y: ARROW_STEP },
};

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function middle(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** A pointer's spot measured from the frame's middle, as the zoom math expects. */
function fromCenter({ element, point }: { element: HTMLElement; point: Point }): Point {
  const box = element.getBoundingClientRect();
  return { x: point.x - box.left - box.width / 2, y: point.y - box.top - box.height / 2 };
}

/**
 * Zooming and moving a picture inside its frame by every means a device has: pinching and
 * dragging with fingers, the wheel or a trackpad pinch and dragging with a mouse, a double tap,
 * the keyboard (+, -, 0 and the arrows) and the host's buttons. The frame takes over touch
 * gestures (`touch-none`), so the page itself never zooms.
 */
export function usePanZoom({ active }: { active: boolean }) {
  // The frame mounts only while the viewer is open, so its observers follow the element itself.
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [frame, setFrame] = useState<Frame>({ height: 0, width: 0 });
  const [view, setView] = useState<PanZoom>(FIT);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<Pinch | null>(null);

  useEffect(() => {
    if (!element) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setFrame({ height: entry.contentRect.height, width: entry.contentRect.width });
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  // React's wheel listener is passive, and a zoom must keep the page from scrolling.
  useEffect(() => {
    if (!element) {
      return;
    }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const point = fromCenter({ element, point: { x: event.clientX, y: event.clientY } });
      const box = element.getBoundingClientRect();
      const size = { height: box.height, width: box.width };

      setView((current) =>
        zoomAt({
          frame: size,
          point,
          scale: current.scale * Math.exp(-event.deltaY * WHEEL_ZOOM_SPEED),
          view: current,
        }),
      );
    };

    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [element]);

  const zoomBy = (factor: number) =>
    setView((current) =>
      zoomAt({ frame, point: { x: 0, y: 0 }, scale: current.scale * factor, view: current }),
    );

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const [first, second] = [...pointers.current.values()];

    if (first && second) {
      pinch.current = {
        distance: distance(first, second),
        middle: fromCenter({ element: event.currentTarget, point: middle(first, second) }),
        view,
      };
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const last = pointers.current.get(event.pointerId);

    if (!last) {
      return;
    }

    const point = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, point);
    const [first, second] = [...pointers.current.values()];
    const start = pinch.current;

    if (first && second && start) {
      const now = fromCenter({ element: event.currentTarget, point: middle(first, second) });

      const zoomed = zoomAt({
        frame,
        point: start.middle,
        scale: start.view.scale * (distance(first, second) / (start.distance || 1)),
        view: start.view,
      });

      setView(
        panBy({
          delta: { x: now.x - start.middle.x, y: now.y - start.middle.y },
          frame,
          view: zoomed,
        }),
      );

      return;
    }

    setView((current) =>
      panBy({ delta: { x: point.x - last.x, y: point.y - last.y }, frame, view: current }),
    );
  };

  const onPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);

    if (pointers.current.size < 2) {
      pinch.current = null;
    }
  };

  const onDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const point = fromCenter({
      element: event.currentTarget,
      point: { x: event.clientX, y: event.clientY },
    });

    setView((current) =>
      current.scale > 1 ? FIT : zoomAt({ frame, point, scale: DOUBLE_TAP_SCALE, view: current }),
    );
  };

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const arrow = ARROWS[event.key];

    if (arrow) {
      event.preventDefault();
      setView((current) => panBy({ delta: arrow, frame, view: current }));
    } else if (event.key === "+" || event.key === "=") {
      zoomBy(ZOOM_STEP);
    } else if (event.key === "-") {
      zoomBy(1 / ZOOM_STEP);
    } else if (event.key === "0") {
      setView(FIT);
    }
  });

  // The keys work wherever focus is while the viewer is open, its buttons included.
  useEffect(() => {
    if (!active) {
      return;
    }

    globalThis.addEventListener("keydown", onKeyDown);
    return () => globalThis.removeEventListener("keydown", onKeyDown);
  }, [active]);

  return {
    fit: () => setView(FIT),
    frame,
    frameProps: {
      onDoubleClick,
      onPointerCancel: onPointerEnd,
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      ref: setElement,
    },
    view: clampPanZoom({ frame, view }),
    zoomIn: () => zoomBy(ZOOM_STEP),
    zoomOut: () => zoomBy(1 / ZOOM_STEP),
  };
}
