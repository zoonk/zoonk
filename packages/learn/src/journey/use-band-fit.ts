"use client";

import { useLayoutEffect, useRef } from "react";
import { type BandFit, fitBandSizes, getBandMinProperty } from "./roadmap-styles";

function getBands(list: HTMLElement): HTMLElement[] {
  return [...list.children].filter((child) => child instanceof HTMLElement);
}

function setFit(bands: HTMLElement[], fit: (index: number) => BandFit) {
  for (const [index, band] of bands.entries()) {
    band.dataset.fit = fit(index);
  }
}

/**
 * Each band's least width with its names broken this way (with no room, a column takes its least),
 * and the room the gaps between them take.
 */
function measureLeast(list: HTMLElement, bands: HTMLElement[], fit: BandFit) {
  setFit(bands, () => fit);
  list.style.width = "0px";
  const boxes = bands.map((band) => band.getBoundingClientRect());
  list.style.width = "";

  const widths = boxes.map((box) => box.width);
  const span = (boxes.at(-1)?.right ?? 0) - (boxes[0]?.left ?? 0);

  return { gaps: span - widths.reduce((total, width) => total + width, 0), widths };
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

  const bands = getBands(list);

  for (const index of bands.keys()) {
    list.style.removeProperty(getBandMinProperty(index));
  }

  const parts = measureLeast(list, bands, "parts");
  const words = measureLeast(list, bands, "words");

  const sizes = fitBandSizes({
    available: list.clientWidth - parts.gaps,
    parts: parts.widths,
    words: words.widths,
  });

  setFit(bands, (index) => sizes[index]?.fit ?? "parts");

  for (const [index, { width }] of sizes.entries()) {
    if (width !== null) {
      list.style.setProperty(getBandMinProperty(index), `${width}px`);
    }
  }

  measureTodayName(list);
}

/**
 * Sizes the bands (`fitBandSizes`) before the row paints: after every render, since the names may
 * have changed, and whenever the row's width or its font does. It watches `width`, a line the
 * names never resize, so the row growing a line doesn't report a resize of its own.
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
