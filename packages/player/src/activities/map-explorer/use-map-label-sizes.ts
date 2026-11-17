"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { measureDrawingLabel } from "../_utils/drawing-label";
import { type MapPoint } from "./map-viewport";

const STREET_SAMPLE_STEP = 4;

type MapLabelSize = {
  positions?: readonly MapPoint[];
  height: number;
  offsetX: number;
  offsetY: number;
  width: number;
};

export function useMapLabelSizes(labelKey: string, pixelSize: number) {
  const elements = useRef(new Map<number, SVGTextElement>());

  const [cache, setCache] = useState<{
    labelKey: string;
    pixelSize: number;
    sizes: Readonly<Record<number, MapLabelSize>>;
  } | null>(null);

  const measureLabel = useCallback((index: number, element: SVGTextElement | null) => {
    if (element) {
      elements.current.set(index, element);
    } else {
      elements.current.delete(index);
    }
  }, []);

  useLayoutEffect(() => {
    const measure = () => {
      const sizes = Object.fromEntries(
        [...elements.current].map(([index, element]) => {
          const street = [
            ...(element
              .closest('[data-slot="base-map"]')
              ?.querySelectorAll<SVGPathElement>("[data-street]") ?? []),
          ].find((path) => path.dataset.street === element.dataset.streetLabel);

          const bounds = street?.getBBox();

          const steps = bounds
            ? Math.max(
                1,
                Math.ceil((bounds.width + bounds.height) / pixelSize / STREET_SAMPLE_STEP),
              )
            : 0;

          const length = street?.getTotalLength() ?? 0;

          const positions =
            street &&
            Array.from({ length: steps + 1 }, (_, step) => {
              const point = street.getPointAtLength((length * step) / steps);
              return { x: point.x, y: point.y };
            });

          return [index, { ...measureDrawingLabel({ element, pixelSize }), positions }];
        }),
      );

      const next = { labelKey, pixelSize, sizes };
      setCache((known) => (JSON.stringify(known) === JSON.stringify(next) ? known : next));
    };

    measure();
    const observer = new ResizeObserver(measure);

    for (const element of elements.current.values()) {
      observer.observe(element);
    }

    document.fonts.addEventListener("loadingdone", measure);

    return () => {
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", measure);
    };
  }, [labelKey, pixelSize]);

  const sizes: Readonly<Record<number, MapLabelSize>> =
    cache?.labelKey === labelKey && cache.pixelSize === pixelSize ? cache.sizes : {};

  return { measureLabel, sizes };
}
