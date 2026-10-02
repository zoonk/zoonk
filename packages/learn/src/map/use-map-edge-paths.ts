"use client";

import { useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { type SkillMapEdge } from "./skill-map-layers";

type EdgePath = { key: string; path: string };

function samePaths(first: EdgePath[], second: EdgePath[]): boolean {
  return (
    first.length === second.length &&
    first.every(
      (edge, index) => edge.key === second[index]?.key && edge.path === second[index]?.path,
    )
  );
}

/** A soft curve from the bottom of one node to the top of the next row's node. */
function toPath({ from, to }: { from: DOMRect; to: DOMRect }, origin: DOMRect): string {
  const x1 = from.left + from.width / 2 - origin.left;
  const y1 = from.bottom - origin.top;
  const x2 = to.left + to.width / 2 - origin.left;
  const y2 = to.top - origin.top;
  const middle = (y1 + y2) / 2;

  return `M ${x1} ${y1} C ${x1} ${middle}, ${x2} ${middle}, ${x2} ${y2}`;
}

/**
 * The map's links as SVG paths between its nodes, measured after layout: node labels wrap, so
 * their size and place depend on the text and the screen. Re-measures when the map resizes.
 */
export function useMapEdgePaths(edges: readonly SkillMapEdge[]) {
  const containerRef = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<string, HTMLElement>());
  const [paths, setPaths] = useState<EdgePath[]>([]);

  const measure = useEffectEvent(() => {
    const origin = containerRef.current?.getBoundingClientRect();

    if (!origin) {
      return;
    }

    const next = edges.flatMap((edge) => {
      const from = nodes.current.get(edge.from)?.getBoundingClientRect();
      const to = nodes.current.get(edge.to)?.getBoundingClientRect();

      return from && to
        ? [{ key: `${edge.from}:${edge.to}`, path: toPath({ from, to }, origin) }]
        : [];
    });

    setPaths((current) => (samePaths(current, next) ? current : next));
  });

  /* A node's label can wrap differently after any render (a selection, new data), so measure. */
  useLayoutEffect(() => {
    measure();
  });

  useLayoutEffect(() => {
    const element = containerRef.current;

    if (!element) {
      return;
    }

    const observer = new ResizeObserver(() => measure());
    observer.observe(element);

    // Web fonts arriving late rewrap labels without always resizing the map.
    void document.fonts.ready.then(() => measure());

    return () => observer.disconnect();
  }, []);

  function register(id: string) {
    return (element: HTMLElement | null) => {
      if (element) {
        nodes.current.set(id, element);
      } else {
        nodes.current.delete(id);
      }
    };
  }

  return { containerRef, paths, register };
}
