"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { measureDrawingInk } from "../_utils/drawing-label";
import { MAP_STREET_SAMPLE_STEP } from "./map-label-geometry";
import { type MapBox, type MapPoint } from "./map-viewport";

type MapLabelSize = ReturnType<typeof measureDrawingInk>;

export function useMapLabelSizes(labelKey: string, pixelSize: number) {
  const elements = useRef(new Map<number, SVGTextElement>());

  const [cache, setCache] = useState<{
    labelKey: string;
    pixelSize: number;
    sizes: Readonly<Record<number, MapLabelSize>>;
    streets: Readonly<Record<string, readonly MapPoint[]>>;
    pinNumbers: readonly MapBox[];
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
      const context = document.createElement("canvas").getContext("2d");

      if (!context) {
        return;
      }

      const map = [...elements.current.values()][0]?.closest('[data-slot="base-map"]');
      const paths = map?.querySelectorAll<SVGPathElement>("[data-street]") ?? [];

      const streets = Object.fromEntries(
        [...paths].map((street): [string, readonly MapPoint[]] => {
          const bounds = street.getBBox();

          const steps = Math.max(
            1,
            Math.ceil((bounds.width + bounds.height) / pixelSize / MAP_STREET_SAMPLE_STEP),
          );

          const length = street.getTotalLength();

          return [
            street.dataset.street ?? "",
            Array.from({ length: steps + 1 }, (_, step) => {
              const point = street.getPointAtLength((length * step) / steps);
              return { x: point.x, y: point.y };
            }),
          ];
        }),
      );

      const sizes = Object.fromEntries(
        [...elements.current].map(([index, element]): [number, MapLabelSize] => [
          index,
          measureDrawingInk({ context, element, pixelSize }),
        ]),
      );

      const bounds = map?.getBoundingClientRect();

      const pinNumbers = [
        ...(map?.querySelectorAll<HTMLElement>('[data-slot="map-pin"] > span') ?? []),
      ].map((element) => {
        const style = getComputedStyle(element);
        context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const ink = context.measureText(element.textContent ?? "");
        const box = element.getBoundingClientRect();
        const width = ink.actualBoundingBoxLeft + ink.actualBoundingBoxRight;
        const height = ink.actualBoundingBoxAscent + ink.actualBoundingBoxDescent;

        return {
          height,
          width,
          x: (box.left + box.right - width) / 2 - (bounds?.left ?? 0),
          y: (box.top + box.bottom - height) / 2 - (bounds?.top ?? 0),
        };
      });

      const next = { labelKey, pinNumbers, pixelSize, sizes, streets };
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

  const streets =
    cache?.labelKey === labelKey && cache.pixelSize === pixelSize ? cache.streets : {};

  const pinNumbers =
    cache?.labelKey === labelKey && cache.pixelSize === pixelSize ? cache.pinNumbers : undefined;

  return { measureLabel, pinNumbers, sizes, streets };
}
