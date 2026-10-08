"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { type BaseMapDrawing, type BaseMapRegionTone } from "../_assets/base-maps/base-map-drawing";
import { type MapBox, type MapPoint } from "./map-viewport";

const REGION_CLASS: Record<BaseMapRegionTone, string> = {
  context: "fill-muted",
  focus: "fill-background",
  groupA: "fill-viz-accent-soft",
  groupB: "fill-viz-highlight-soft",
  groupC: "fill-success/15",
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
  /** Where the pin is drawn, in pixels, after nudging overlapping pins apart. */
  shown: MapPoint;
  /** Where the place really is, in pixels. */
  spot: MapPoint;
};

/** The base map itself, cropped to the places and drawn at the canvas's real size. */
function MapShapes({
  drawing,
  labelText,
  pixelSize,
}: {
  drawing: BaseMapDrawing;
  labelText: (key: string | null, text: string) => string;
  /** Map units per screen pixel, so text and strokes keep their size at any zoom. */
  pixelSize: number;
}) {
  return (
    <>
      {drawing.sphere && <path className="fill-viz-secondary-soft" d={drawing.sphere} />}

      <g className="stroke-border" strokeLinejoin="round">
        {drawing.regions.map((region) => (
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
            key={street.name}
            strokeWidth={STREET_WIDTH}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>

      {drawing.insets.map((inset) => (
        <rect
          className="stroke-border fill-none"
          height={inset.height}
          key={`${inset.x}-${inset.y}`}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          width={inset.width}
          x={inset.x}
          y={inset.y}
        />
      ))}

      {drawing.labels.map((label) => (
        <text
          className={cn(
            "stroke-background",
            label.kind === "street"
              ? "fill-muted-foreground font-medium"
              : "fill-foreground/75 font-semibold",
          )}
          dominantBaseline="middle"
          fontSize={LABEL_SIZE * pixelSize}
          key={`${label.text}-${label.x}-${label.y}`}
          paintOrder="stroke"
          strokeLinejoin="round"
          strokeWidth={LABEL_HALO * pixelSize}
          textAnchor="middle"
          transform={label.angle ? `rotate(${label.angle} ${label.x} ${label.y})` : undefined}
          x={label.x}
          y={label.y}
        >
          {labelText(label.key, label.text)}
        </text>
      ))}
    </>
  );
}

/**
 * A base map with numbered pins for the places to explore. The drawing is decorative for screen
 * readers; the pins are buttons named after their places, and the text alternative describes
 * the map.
 */
export function BaseMapView({
  crop,
  drawing,
  height,
  labelText,
  onSelect,
  pins,
  width,
}: {
  crop: MapBox;
  drawing: BaseMapDrawing;
  height: number;
  labelText: (key: string | null, text: string) => string;
  onSelect: (id: string) => void;
  pins: readonly MapPin[];
  width: number;
}) {
  const pixelSize = crop.width / width;

  const toMap = (point: MapPoint) => ({
    x: crop.x + point.x * pixelSize,
    y: crop.y + point.y * pixelSize,
  });

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl",
        !drawing.sphere && "bg-viz-secondary-soft",
      )}
      data-slot="base-map"
      style={{ height }}
    >
      <svg
        aria-hidden="true"
        className="absolute inset-0 block"
        height={height}
        viewBox={`${crop.x} ${crop.y} ${crop.width} ${crop.height}`}
        width={width}
      >
        <MapShapes drawing={drawing} labelText={labelText} pixelSize={pixelSize} />

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
          aria-label={pin.label}
          aria-pressed={pin.isSelected}
          className="focus-visible:ring-ring/50 absolute flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none focus-visible:ring-[3px]"
          data-slot="map-pin"
          key={pin.id}
          onClick={() => onSelect(pin.id)}
          style={{ left: pin.shown.x, top: pin.shown.y }}
          type="button"
        >
          <span
            className={cn(
              "border-viz-accent flex size-8 items-center justify-center rounded-full border-2 text-sm font-bold tabular-nums shadow-md motion-safe:transition-colors",
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
