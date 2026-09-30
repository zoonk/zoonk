"use client";

import { useEffectEvent, useLayoutEffect, useRef, useState } from "react";

function sameCenters(first: Record<string, number>, second: Record<string, number>): boolean {
  const keys = Object.keys(first);

  return (
    keys.length === Object.keys(second).length && keys.every((key) => first[key] === second[key])
  );
}

/**
 * The vertical middle of each card in a column, measured after layout (cards wrap their text,
 * so their heights vary), for drawing arrows between them. Re-measures when the column resizes.
 */
export function useCardCenters() {
  const containerRef = useRef<HTMLOListElement>(null);
  const cards = useRef(new Map<string, HTMLElement>());
  const [centers, setCenters] = useState<Record<string, number>>({});

  const measure = useEffectEvent(() => {
    const next = Object.fromEntries(
      [...cards.current].map(([id, element]) => [id, element.offsetTop + element.offsetHeight / 2]),
    );

    setCenters((current) => (sameCenters(current, next) ? current : next));
  });

  /* Cards change height when their text wraps or a link list grows, so measure after each render. */
  useLayoutEffect(() => {
    measure();
  });

  useLayoutEffect(() => {
    measure();
    const element = containerRef.current;

    if (!element) {
      return;
    }

    const observer = new ResizeObserver(() => measure());
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function register(id: string) {
    return (element: HTMLElement | null) => {
      if (element) {
        cards.current.set(id, element);
      } else {
        cards.current.delete(id);
      }
    };
  }

  return { centers, containerRef, register };
}
