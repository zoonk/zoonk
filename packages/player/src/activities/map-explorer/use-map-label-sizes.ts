"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { type MapPoint } from "./map-viewport";

const STREET_SAMPLE_STEP = 4;

const rounded = (value: number) => Number(value.toFixed(3));

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
          const box = element.getBBox();

          const street = [
            ...(element.ownerSVGElement?.querySelectorAll<SVGPathElement>("[data-street]") ?? []),
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

          return [
            index,
            {
              height: rounded(box.height / pixelSize),
              offsetX: rounded(
                (box.x + box.width / 2 - Number(element.getAttribute("x"))) / pixelSize,
              ),
              offsetY: rounded(
                (box.y + box.height / 2 - Number(element.getAttribute("y"))) / pixelSize,
              ),
              positions,
              width: rounded(box.width / pixelSize),
            },
          ];
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
