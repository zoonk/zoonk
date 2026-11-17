"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { type BaseMapDrawing, type BaseMapRegionTone } from "../_assets/base-maps/base-map-drawing";
import { type MapBox, type MapPoint, placeMapLabels, strayRegions } from "./map-viewport";
import { useMapLabelSizes } from "./use-map-label-sizes";

const REGION_CLASS: Record<BaseMapRegionTone, string> = {
  context: "fill-muted",
  focus: "fill-background",
  groupA: "fill-viz-accent-soft",
  groupB: "fill-viz-highlight-soft",
  groupC: "fill-viz-secondary-soft",
};

const LABEL_SIZE = 12;
const LABEL_HALO = 3;
const STREET_WIDTH = 9;
const TRUE_SPOT_RADIUS = 3.5;

export type MapPin = {
  id: string;
  isSelected: boolean;
  isVisited: boolean;
  label: string;
  number: number;
  shown: MapPoint;
  spot: MapPoint;
};

function MapShapes({
  drawing,
  labelSpots,
  labelText,
  pixelSize,
  measureLabel,
  labelSizes,
}: {
  drawing: BaseMapDrawing;
  labelSpots: readonly (MapPoint | null)[];
  labelText: (key: string | null, text: string) => string;
  pixelSize: number;
  labelSizes: Readonly<Record<number, { offsetX: number; offsetY: number }>>;
  measureLabel: (index: number, element: SVGTextElement | null) => void;
}) {
  const stray = strayRegions({
    labels: drawing.labels,
    legendTones: drawing.legend.map((item) => item.tone),
    regions: drawing.regions,
    spots: labelSpots,
  });

  return (
    <>
      {drawing.sphere && <path className="fill-viz-secondary-soft" d={drawing.sphere} />}

      <g className="stroke-viz-grid" strokeLinejoin="round">
        {drawing.regions
          .filter((region) => !stray.includes(region.id))
          .map((region) => (
            <path
              className={REGION_CLASS[region.tone]}
              d={region.path}
              key={region.id}
              strokeWidth={0.75}
              vectorEffect="non-scaling-stroke"
            />
          ))}
      </g>

      <g className="stroke-background fill-none" strokeLinecap="round">
        {drawing.streets.map((street) => (
          <path
            d={street.path}
            data-street={street.name}
            key={street.name}
            strokeWidth={STREET_WIDTH}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>

      {drawing.insets.map((inset) => (
        <rect
          className="stroke-viz-grid fill-none"
          height={inset.height}
          key={`${inset.x}-${inset.y}`}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          width={inset.width}
          x={inset.x}
          y={inset.y}
        />
      ))}

      <g>
        {drawing.labels.map((label, index) => {
          const spot = labelSpots[index];

          const at = spot ?? label;

          return (
            <text
              className={cn(
                "stroke-background",
                label.kind === "street"
                  ? "fill-muted-foreground font-medium"
                  : "fill-foreground/75 font-semibold",
              )}
              style={{ visibility: spot ? "visible" : "hidden" }}
              ref={(element) => measureLabel(index, element)}
              data-street-label={label.kind === "street" ? label.text : undefined}
              dominantBaseline="middle"
              fontSize={LABEL_SIZE * pixelSize}
              key={`${label.text}-${label.x}-${label.y}`}
              paintOrder="stroke"
              strokeLinejoin="round"
              strokeWidth={LABEL_HALO * pixelSize}
              textAnchor="middle"
              transform={label.angle ? `rotate(${label.angle} ${at.x} ${at.y})` : undefined}
              x={at.x - (labelSizes[index]?.offsetX ?? 0) * pixelSize}
              y={at.y - (labelSizes[index]?.offsetY ?? 0) * pixelSize}
            >
              {labelText(label.key, label.text)}
            </text>
          );
        })}
      </g>
    </>
  );
}

export function BaseMapView({
  crop,
  drawing,
  height,
  labelText,
  onSelect,
  pins,
  width,
  references,
}: {
  crop: MapBox;
  drawing: BaseMapDrawing;
  height: number;
  labelText: (key: string | null, text: string) => string;
  onSelect: (id: string) => void;
  pins: readonly MapPin[];
  width: number;
  references: string;
}) {
  const pixelSize = crop.width / width;

  const toMap = (point: MapPoint) => ({
    x: crop.x + point.x * pixelSize,
    y: crop.y + point.y * pixelSize,
  });

  const labelKey = JSON.stringify({
    labels: drawing.labels.map((label) => [
      label.text,
      label.kind,
      label.x,
      label.y,
      labelText(label.key, label.text),
    ]),
    streets: drawing.streets,
  });

  const { sizes, measureLabel } = useMapLabelSizes(labelKey, pixelSize);

  const measured = drawing.labels.map((label, index) => ({
    angle: label.angle,
    height: sizes[index]?.height ?? 0,
    kind: label.kind,
    positions: sizes[index]?.positions?.map((point) => ({
      x: (point.x - crop.x) / pixelSize,
      y: (point.y - crop.y) / pixelSize,
    })),
    priority: references
      .toLocaleLowerCase()
      .includes(labelText(label.key, label.text).toLocaleLowerCase()),
    text: labelText(label.key, label.text),
    width: sizes[index]?.width ?? 0,
    x: (label.x - crop.x) / pixelSize,
    y: (label.y - crop.y) / pixelSize,
  }));

  const labelSpots = (
    drawing.labels.every(
      (_, index) => (sizes[index]?.width ?? 0) > 0 && (sizes[index]?.height ?? 0) > 0,
    )
      ? placeMapLabels({
          frame: { height, width },
          labels: measured,
          pins: pins.map((pin) => pin.shown),
        })
      : drawing.labels.map(() => null)
  ).map((spot) => spot && toMap(spot));

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl",
        !drawing.sphere && "bg-viz-secondary-soft",
      )}
      data-slot="base-map"
      style={{ height }}
    >
      <svg
        aria-hidden="true"
        className="absolute inset-0 block select-none"
        height={height}
        viewBox={`${crop.x} ${crop.y} ${crop.width} ${crop.height}`}
        width={width}
      >
        <MapShapes
          drawing={drawing}
          labelSpots={labelSpots}
          labelText={labelText}
          pixelSize={pixelSize}
          measureLabel={measureLabel}
          labelSizes={sizes}
        />

        {pins.map((pin) => {
          const [spot, shown] = [toMap(pin.spot), toMap(pin.shown)];

          return (
            <g className="text-viz-accent" key={pin.id}>
              {(spot.x !== shown.x || spot.y !== shown.y) && (
                <path
                  className="stroke-current"
                  d={`M${spot.x} ${spot.y} L${shown.x} ${shown.y}`}
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                />
              )}
              <circle
                className="fill-current"
                cx={spot.x}
                cy={spot.y}
                r={TRUE_SPOT_RADIUS * pixelSize}
              />
            </g>
          );
        })}
      </svg>

      {pins.map((pin) => (
        <button
          aria-label={`${pin.number}. ${pin.label}`}
          aria-pressed={pin.isSelected}
          className="focus-visible:ring-ring/50 absolute flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none select-none focus-visible:ring-[3px]"
          data-slot="map-pin"
          key={pin.id}
          onClick={() => onSelect(pin.id)}
          style={{ left: pin.shown.x, top: pin.shown.y }}
          type="button"
        >
          <span
            className={cn(
              "border-viz-accent flex size-8 items-center justify-center rounded-full border-2 text-sm font-semibold tabular-nums shadow-md motion-safe:transition-colors",
              pin.isSelected && "bg-viz-accent text-background ring-viz-accent/30 ring-4",
              !pin.isSelected && pin.isVisited && "bg-viz-accent-soft text-viz-accent",
              !pin.isSelected && !pin.isVisited && "bg-background text-viz-accent",
            )}
          >
            {pin.number}
          </span>
        </button>
      ))}
    </div>
  );
}
