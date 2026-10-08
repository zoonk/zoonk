import { geoArea } from "d3-geo";
import { type MultiPolygon, type Polygon, type Position } from "geojson";
import { difference, intersection, union } from "polyclip-ts";

type Pair = [number, number];

/** Polygons in the planar form polyclip-ts works with (longitude, latitude). */
export type Shape = Pair[][][];

/** A rectangle in degrees, like a map's area. */
export type GeoRectangle = { east: number; north: number; south: number; west: number };

function toPair(position: Position): Pair {
  return [position[0] ?? 0, position[1] ?? 0];
}

const FULL_TURN = 360;
const HALF_TURN = 180;
const POLE = 89.9;

/**
 * A ring that crosses the antimeridian jumps from 180° to −180° between two points; on a flat
 * plane it would wrap around the whole world. Moving its western points past 180° keeps it
 * continuous (d3 reads 190° as −170°). Rings around a pole, like Antarctica's, are left alone.
 */
function unwrapRing(ring: Pair[]): Pair[] {
  const crosses = ring.some(
    (point, index) =>
      index > 0 && Math.abs(point[0] - (ring[index - 1]?.[0] ?? point[0])) > HALF_TURN,
  );

  const aroundPole = ring.some((point) => Math.abs(point[1]) >= POLE);

  return crosses && !aroundPole
    ? ring.map(([longitude, latitude]) => [
        longitude < 0 ? longitude + FULL_TURN : longitude,
        latitude,
      ])
    : ring;
}

export function toShape(geometry: Polygon | MultiPolygon): Shape {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;

  return polygons.map((rings) =>
    rings.map((ring) => unwrapRing(ring.map((position) => toPair(position)))),
  );
}

/**
 * Points written as "longitude latitude" pairs separated by commas, the way outlines are kept
 * in this folder: "5.8 49.6, 6.8 49.2".
 */
export function parsePoints(text: string): Pair[] {
  return text.split(",").map((pair) => {
    const [longitude = Number.NaN, latitude = Number.NaN] = pair.trim().split(/\s+/u).map(Number);

    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      throw new TypeError(`"${pair}" isn't a "longitude latitude" pair`);
    }

    return [longitude, latitude];
  });
}

/**
 * Where a projection centers, written like an outline point ("20 40" is 20°E, 40°N), as the
 * rotation d3 expects.
 */
export function centeredOn(text: string): [number, number, number] {
  const [center] = parsePoints(text);
  return center ? [-center[0], -center[1], 0] : [0, 0, 0];
}

/** A closed ring from corner points in degrees, as pairs or written out as text. */
export function polygonShape(points: string | readonly Pair[]): Shape {
  const corners = typeof points === "string" ? parsePoints(points) : points;
  const first = corners[0];
  return first ? [[[...corners, first]]] : [];
}

export function rectangleShape(area: GeoRectangle): Shape {
  return polygonShape([
    [area.west, area.south],
    [area.east, area.south],
    [area.east, area.north],
    [area.west, area.north],
  ]);
}

export function unionAll(shapes: readonly Shape[]): Shape {
  const [first, ...rest] = shapes.filter((shape) => shape.length > 0);
  return first ? union(first, ...rest) : [];
}

export function intersect(first: Shape, second: Shape): Shape {
  return first.length === 0 || second.length === 0 ? [] : intersection(first, second);
}

export function subtract(subject: Shape, ...others: Shape[]): Shape {
  const clips = others.filter((shape) => shape.length > 0);
  return subject.length === 0 || clips.length === 0 ? subject : difference(subject, ...clips);
}

/** Half the sphere, in steradians: no region of a map is bigger. */
const HALF_SPHERE = 2 * Math.PI;

/**
 * d3 draws on the sphere, where a ring's direction decides which side is inside: the wrong one
 * fills the rest of the globe. polyclip-ts doesn't keep a direction d3 agrees with (rings along
 * the antimeridian flip), so each polygon is turned until it covers less than half the sphere.
 */
function orientForSphere(rings: Pair[][]): Pair[][] {
  const polygon: Polygon = { coordinates: rings, type: "Polygon" };
  return geoArea(polygon) > HALF_SPHERE ? rings.map((ring) => ring.toReversed()) : rings;
}

/** Back to GeoJSON for d3. */
export function toGeometry(shape: Shape): MultiPolygon {
  return {
    coordinates: shape.map((rings) => orientForSphere(rings.map((ring) => ring.toReversed()))),
    type: "MultiPolygon",
  };
}
