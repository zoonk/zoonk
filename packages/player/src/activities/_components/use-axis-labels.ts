"use client";
import { fittingTickIndices } from "@zoonk/utils/plot-scale";
import { useLayoutEffect, useRef } from "react";
import { edgeAnchor } from "../_utils/drawing-label";

export function useAxisLabels({
  labelKey,
  range,
}: {
  labelKey: string;
  range: readonly [number, number];
}) {
  const ref = useRef<SVGGElement>(null);

  const [left, right] = range;

  useLayoutEffect(() => {
    const group = ref.current;

    if (!group) {
      return;
    }

    const nodes = [...group.querySelectorAll<SVGTextElement>("text")];

    const measure = () => {
      const frames = nodes.map((node) => {
        const width = node.getBBox().width;
        const at = Number(node.getAttribute("x"));
        const anchor = edgeAnchor({ at, range: [left, right], width });
        node.setAttribute("text-anchor", anchor);
        const start = at - width * { end: 1, middle: 0.5, start: 0 }[anchor];
        return { left: start, right: start + width };
      });

      const shown = fittingTickIndices(frames);

      nodes.forEach((node, index) =>
        node.setAttribute("visibility", shown.includes(index) ? "visible" : "hidden"),
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    nodes.forEach((node) => observer.observe(node));
    document.fonts.addEventListener("loadingdone", measure);

    return () => {
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", measure);
    };
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- Keyed ticks and translated labels can replace the observed nodes.
  }, [labelKey, left, right]);

  return ref;
}
