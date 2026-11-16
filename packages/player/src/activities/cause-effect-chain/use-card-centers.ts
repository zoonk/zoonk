"use client";

import { useEffectEvent, useLayoutEffect, useRef, useState } from "react";

type CardBox = { center: number; half: number };

function sameBoxes(first: Record<string, CardBox>, second: Record<string, CardBox>): boolean {
  const keys = Object.keys(first);

  return (
    keys.length === Object.keys(second).length &&
    keys.every(
      (key) => first[key]?.center === second[key]?.center && first[key]?.half === second[key]?.half,
    )
  );
}

export function useCardCenters() {
  const containerRef = useRef<HTMLOListElement>(null);
  const cards = useRef(new Map<string, HTMLElement>());
  const [boxes, setBoxes] = useState<Record<string, CardBox>>({});

  const measure = useEffectEvent(() => {
    const next = Object.fromEntries(
      [...cards.current].map(([id, element]) => {
        const half = element.offsetHeight / 2;
        return [id, { center: element.offsetTop + half, half }];
      }),
    );

    setBoxes((current) => (sameBoxes(current, next) ? current : next));
  });

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

  return { boxes, containerRef, register };
}
