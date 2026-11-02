import { geoArea } from "d3-geo";
import { type MultiPolygon, type Polygon, type Position } from "geojson";
import { difference, intersection, union } from "polyclip-ts";

type Pair = [number, number];

export type Shape = Pair[][][];

export type GeoRectangle = { east: number; north: number; south: number; west: number };

function toPair(position: Position): Pair {
  return [position[0] ?? 0, position[1] ?? 0];
}

const FULL_TURN = 360;
const HALF_TURN = 180;
const POLE = 89.9;

// A flat polygon crossing the antimeridian would wrap around the globe; d3 accepts longitudes beyond 180°.
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

export function parsePoints(text: string): Pair[] {
  return text.split(",").map((pair) => {
    const [longitude = Number.NaN, latitude = Number.NaN] = pair.trim().split(/\s+/u).map(Number);

    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      throw new TypeError(`"${pair}" isn't a "longitude latitude" pair`);
    }

    return [longitude, latitude];
  });
}

export function centeredOn(text: string): [number, number, number] {
  const [center] = parsePoints(text);
  return center ? [-center[0], -center[1], 0] : [0, 0, 0];
}

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

const HALF_SPHERE = 2 * Math.PI;

// d3 uses spherical winding; polyclip-ts rings can otherwise fill the rest of the globe.
function orientForSphere(rings: Pair[][]): Pair[][] {
  const polygon: Polygon = { coordinates: rings, type: "Polygon" };
  return geoArea(polygon) > HALF_SPHERE ? rings.map((ring) => ring.toReversed()) : rings;
}

export function toGeometry(shape: Shape): MultiPolygon {
  return {
    coordinates: shape.map((rings) => orientForSphere(rings.map((ring) => ring.toReversed()))),
    type: "MultiPolygon",
  };
}
