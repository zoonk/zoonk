"use client";

import { type RefObject, useEffect, useState } from "react";
import { type TextWidth, estimateTextWidth } from "./category-labels";
import { LABEL_FONT_SIZE } from "./use-chart-size";

const WEIGHTS = { medium: 500, regular: 400 } as const;

function createTextWidth({
  context,
  family,
}: {
  context: CanvasRenderingContext2D;
  family: string;
}): TextWidth {
  const widths = new Map<string, number>();

  return (text, weight) => {
    const font = `${WEIGHTS[weight ?? "regular"]} ${LABEL_FONT_SIZE}px ${family}`;
    const key = `${font}|${text}`;
    const known = widths.get(key);

    if (known !== undefined) {
      return known;
    }

    context.font = font;
    // Charts draw tabular numbers, where every digit is as wide as a zero.
    const width = context.measureText(text.replaceAll(/\d/gu, "0")).width;
    widths.set(key, width);

    return width;
  };
}

/**
 * Measures labels in the chart's own font once it has loaded, so a layout sized for them fits any
 * script; until then, and on the server, widths are estimated.
 */
export function useTextWidth(ref: RefObject<HTMLElement | null>): TextWidth {
  const [textWidth, setTextWidth] = useState<TextWidth>(() => estimateTextWidth);

  useEffect(() => {
    const element = ref.current;
    const context = document.createElement("canvas").getContext("2d");

    if (!element || !context) {
      return;
    }

    let active = true;
    const { fontFamily } = getComputedStyle(element);

    void document.fonts.ready.then(() => {
      if (active) {
        setTextWidth(() => createTextWidth({ context, family: fontFamily }));
      }
    });

    return () => {
      active = false;
    };
  }, [ref]);

  return textWidth;
}
