"use client";

import { useLayoutEffect, useRef } from "react";
import { chooseBandFit } from "./roadmap-styles";

/** Half a pixel, so a band that rounds onto the row's edge still fits. */
const EDGE = 0.5;

function overflows(list: HTMLElement): boolean {
  const last = list.lastElementChild;

  return (
    last !== null && last.getBoundingClientRect().right > list.getBoundingClientRect().right + EDGE
  );
}

/** `BandTodayTick` breaks around the current band's name, whose lines only the layout knows. */
function measureTodayName(list: HTMLElement) {
  const name = list
    .querySelector('[data-slot="today-tick"]')
    ?.parentElement?.querySelector<HTMLElement>('[data-slot="band-name"]');

  if (name) {
    list.style.setProperty("--band-name-height", `${name.offsetHeight}px`);
  }
}

function fitBands(list: HTMLElement | null) {
  if (!list) {
    return;
  }

  list.dataset.fit = chooseBandFit((fit) => {
    list.dataset.fit = fit;
    return overflows(list);
  });

  measureTodayName(list);
}

/**
 * Picks how the band names break (`BandFit`) before the row paints: after every render, since the
 * names may have changed, and whenever the row's width or its font does. It watches `width`, a
 * line the names never resize, so the row growing a line doesn't report a resize of its own.
 */
export function useBandFit() {
  const listRef = useRef<HTMLOListElement>(null);
  const widthRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    fitBands(listRef.current);
  });

  useLayoutEffect(() => {
    const width = widthRef.current;

    if (!width) {
      return;
    }

    let active = true;

    const fit = () => {
      if (active) {
        fitBands(listRef.current);
      }
    };

    const observer = new ResizeObserver(fit);
    observer.observe(width);
    void document.fonts.ready.then(fit);

    return () => {
      active = false;
      observer.disconnect();
    };
  }, []);

  return { listRef, widthRef };
}
