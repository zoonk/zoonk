"use client";

import { type NumericDomain, fittingTicks } from "@zoonk/utils/plot-scale";
import { useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { edgeAnchor } from "../_utils/drawing-label";

export function useAxisLabels<T extends SVGGElement | HTMLDivElement = SVGGElement>({
  choices,
  domain,
  format,
  position,
  range,
}: {
  choices: readonly number[][];
  domain: NumericDomain;
  format: (value: number) => string;
  position: (value: number) => number;
  range: readonly [number, number];
}) {
  const ref = useRef<T>(null);

  const [layout, setLayout] = useState<{ shown: number[]; starts: Record<number, number> }>({
    shown: choices[0] ?? [],
    starts: {},
  });

  const candidates = choices.map((ticks) =>
    ticks.map((value) => ({ at: position(value), text: format(value), value })),
  );

  const key = JSON.stringify(candidates);
  const measuredChoices = useEffectEvent(() => candidates);
  const [left, right] = range;
  const [min, max] = domain;

  useLayoutEffect(() => {
    const group = ref.current;

    if (!group) {
      return;
    }

    const data = measuredChoices();

    const measure = () => {
      if (right <= left) {
        return;
      }

      const template = group.querySelector(group instanceof SVGElement ? "text" : "span");

      if (!template) {
        return;
      }

      const node = template.cloneNode(true);

      if (!(node instanceof SVGTextElement || node instanceof HTMLSpanElement)) {
        return;
      }

      node.style.visibility = "hidden";

      if (node instanceof HTMLSpanElement) {
        node.style.position = "absolute";
        node.style.whiteSpace = "nowrap";
      }

      group.append(node);
      const starts: Record<number, number> = {};

      const shown = fittingTicks({
        count: data.length,
        domain: [min, max],
        frame: (value) => {
          const tick = data.flat().find((candidate) => candidate.value === value);
          node.textContent = tick?.text ?? String(value);

          const width =
            node instanceof SVGTextElement
              ? node.getBBox().width
              : node.getBoundingClientRect().width;

          const at = tick?.at ?? left;
          const anchor = edgeAnchor({ at, range: [left, right], width });
          const start = at - width * { end: 1, middle: 0.5, start: 0 }[anchor];
          starts[value] = start;
          return { left: start, right: start + width };
        },
        ticks: (count) => data[data.length - count]?.map((tick) => tick.value) ?? [],
      });

      node.remove();

      setLayout((known) =>
        JSON.stringify(known) === JSON.stringify({ shown, starts }) ? known : { shown, starts },
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(group);
    document.fonts.addEventListener("loadingdone", measure);

    return () => {
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", measure);
    };
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- Refit when the formatted values or their positions change.
  }, [key, left, right, min, max]);

  return { ref, ...layout };
}
