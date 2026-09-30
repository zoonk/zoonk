import { type GeoPermissibleObjects, type GeoProjection, geoPath } from "d3-geo";
import { type MultiPoint, type MultiPolygon, type Polygon } from "geojson";
import {
  type BaseMapDrawing,
  type BaseMapProjection,
  type BaseMapRegionTone,
  baseMapDrawingSchema,
} from "../../src/activities/_assets/base-maps/base-map-drawing";
import { createBaseMapProjection } from "../../src/activities/_assets/base-maps/base-map-projection";
import { type GeoRectangle, parsePoints } from "./geo-ops";

/** Every map is drawn 1,000 units wide; its height follows the projection. */
const WIDTH = 1000;
const PATH_DIGITS = 1;
const EDGE_SAMPLES = 24;
const INSET_PADDING = 12;
const HALF_TURN = 180;
const QUARTER_TURN = 90;

type Coordinates = [number, number];

export type MapSource = {
  /** What the projection is fitted to: the whole globe, the map's area or a shape. */
  fit:
    | { kind: "area"; area: GeoRectangle }
    | { kind: "shape"; shape: GeoPermissibleObjects }
    | { kind: "sphere" };
  /** Shapes drawn apart from the rest, framed so they don't read as neighbors. */
  insets?: readonly GeoPermissibleObjects[];
  /** Positions are "longitude latitude", like the outlines. */
  labels?: readonly { key: string | null; position: string; text: string }[];
  legend?: BaseMapDrawing["legend"];
  maxZoom: number;
  projection: Omit<BaseMapProjection, "scale" | "translate">;
  regions: readonly {
    geometry: Polygon | MultiPolygon;
    id: string;
    name: string;
    tone: BaseMapRegionTone;
  }[];
  streets?: readonly { coordinates: readonly Coordinates[]; isLabelled: boolean; name: string }[];
};

function lerp(from: number, to: number, share: number): number {
  return from + (to - from) * share;
}

function segmentLength(segment: { from: Coordinates; to: Coordinates }): number {
  return Math.hypot(segment.to[0] - segment.from[0], segment.to[1] - segment.from[1]);
}

/** The area's outline as points along its edges, so conic projections fit its curved sides. */
function areaOutline(area: GeoRectangle): MultiPoint {
  const steps = Array.from({ length: EDGE_SAMPLES + 1 }, (_, index) => index / EDGE_SAMPLES);

  return {
    coordinates: steps.flatMap((share) => [
      [lerp(area.west, area.east, share), area.south],
      [lerp(area.west, area.east, share), area.north],
      [area.west, lerp(area.south, area.north, share)],
      [area.east, lerp(area.south, area.north, share)],
    ]),
    type: "MultiPoint",
  };
}

function fitObject(fit: MapSource["fit"]): GeoPermissibleObjects {
  if (fit.kind === "sphere") {
    return { type: "Sphere" };
  }

  return fit.kind === "area" ? areaOutline(fit.area) : fit.shape;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function project(projection: GeoProjection, position: Coordinates): Coordinates | null {
  const point = projection(position);
  return point ? [round(point[0]), round(point[1])] : null;
}

/** Text runs along a street and never upside down. */
function uprightAngle(from: Coordinates, to: Coordinates): number {
  const angle = (Math.atan2(to[1] - from[1], to[0] - from[0]) * HALF_TURN) / Math.PI;

  if (angle > QUARTER_TURN) {
    return angle - HALF_TURN;
  }

  return angle < -QUARTER_TURN ? angle + HALF_TURN : angle;
}

/** A street's label sits halfway along its longest stretch. */
function streetLabel(projection: GeoProjection, street: NonNullable<MapSource["streets"]>[number]) {
  const points = street.coordinates.flatMap((position) => {
    const point = project(projection, position);
    return point ? [point] : [];
  });

  const segments = points.slice(1).map((to, index) => ({ from: points[index] ?? to, to }));

  const longest = segments.toSorted(
    (first, second) => segmentLength(second) - segmentLength(first),
  )[0];

  if (!longest) {
    return null;
  }

  return {
    angle: round(uprightAngle(longest.from, longest.to)),
    key: null,
    kind: "street" as const,
    text: street.name,
    x: round((longest.from[0] + longest.to[0]) / 2),
    y: round((longest.from[1] + longest.to[1]) / 2),
  };
}

function insetFrame(path: ReturnType<typeof geoPath>, shape: GeoPermissibleObjects) {
  const [[x0, y0], [x1, y1]] = path.bounds(shape);

  return {
    height: round(y1 - y0 + INSET_PADDING * 2),
    width: round(x1 - x0 + INSET_PADDING * 2),
    x: round(x0 - INSET_PADDING),
    y: round(y0 - INSET_PADDING),
  };
}

/**
 * Projects a map's sources into SVG paths at a fixed width and records the fitted projection,
 * so the player can put places exactly where the shapes are.
 */
export function renderMap(source: MapSource): BaseMapDrawing {
  const fitted = createBaseMapProjection({ ...source.projection, scale: 1, translate: [0, 0] });
  const target = fitObject(source.fit);
  fitted.fitWidth(WIDTH, target);

  const height = Math.ceil(geoPath(fitted).bounds(target)[1][1]);
  const spec = { ...source.projection, scale: fitted.scale(), translate: fitted.translate() };

  /* The projection the player rebuilds from `spec` must match the one the paths use. */
  const projection = createBaseMapProjection(spec);

  if (source.fit.kind !== "shape") {
    projection.clipExtent([
      [0, 0],
      [WIDTH, height],
    ]);
  }

  const path = geoPath(projection).digits(PATH_DIGITS);

  const drawing: BaseMapDrawing = {
    height,
    insets: (source.insets ?? []).map((shape) => insetFrame(path, shape)),
    labels: [
      ...(source.labels ?? []).flatMap((label) => {
        const [position] = parsePoints(label.position);
        const point = position ? project(projection, position) : null;

        return point
          ? [
              {
                angle: 0,
                key: label.key,
                kind: "region" as const,
                text: label.text,
                x: point[0],
                y: point[1],
              },
            ]
          : [];
      }),
      ...(source.streets ?? [])
        .filter((street) => street.isLabelled)
        .flatMap((street) => streetLabel(projection, street) ?? []),
    ],
    legend: source.legend ?? [],
    maxZoom: source.maxZoom,
    projection: spec,
    regions: source.regions
      .map((region) => ({ ...region, path: path(region.geometry) ?? "" }))
      .filter((region) => region.path !== "")
      .map((region) => ({
        id: region.id,
        name: region.name,
        path: region.path,
        tone: region.tone,
      })),
    sphere: source.fit.kind === "sphere" ? (path({ type: "Sphere" }) ?? null) : null,
    streets: (source.streets ?? []).map((street) => ({
      name: street.name,
      path:
        path({ coordinates: street.coordinates.map((point) => [...point]), type: "LineString" }) ??
        "",
    })),
    width: WIDTH,
  };

  return baseMapDrawingSchema.parse(drawing);
}
