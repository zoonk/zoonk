import { type GeoJsonProperties, type MultiPolygon, type Polygon } from "geojson";
import southAmerica50m from "sane-topojson/dist/south-america_50m.json" with { type: "json" };
import { feature, merge } from "topojson-client";
import { presimplify, simplify, sphericalTriangleArea } from "topojson-simplify";
import {
  type GeometryObject,
  type Objects,
  type MultiPolygon as TopoMultiPolygon,
  type Polygon as TopoPolygon,
  type Topology,
} from "topojson-specification";
import usStates10m from "us-atlas/states-10m.json" with { type: "json" };
import countries50m from "world-atlas/countries-50m.json" with { type: "json" };
import countries110m from "world-atlas/countries-110m.json" with { type: "json" };

/**
 * The datasets maps are drawn from: Natural Earth (public domain, through world-atlas and
 * sane-topojson) and the US Census Bureau (through us-atlas).
 */
const SOURCES = { countries110m, countries50m, southAmerica50m, usStates10m };

export type SourceName = keyof typeof SOURCES;

/** A country or state from the source data, with the name maps use. */
export type SourceArea = { geometry: Polygon | MultiPolygon; id: string; name: string };

type Describe = (properties: GeoJsonProperties, id: string) => string | null;

type SourceTopology = Topology<Objects>;

function isTopology(value: unknown): value is SourceTopology {
  return (
    typeof value === "object" && value !== null && "type" in value && value.type === "Topology"
  );
}

const topologies = new Map<string, SourceTopology>();

/**
 * A dataset's topology, simplified to `detail`: the smallest triangle (in steradians) a point must make with its
 * neighbors to stay. Simplifying the topology keeps shared borders identical on both sides.
 */
function readTopology(source: SourceName, detail: number): SourceTopology {
  const key = `${source}@${detail}`;
  const cached = topologies.get(key);

  if (cached) {
    return cached;
  }

  const value: unknown = SOURCES[source];

  if (!isTopology(value)) {
    throw new TypeError(`${source} isn't a TopoJSON topology`);
  }

  const topology = detail > 0 ? simplify(presimplify(value, sphericalTriangleArea), detail) : value;
  topologies.set(key, topology);
  return topology;
}

function objectOf(topology: SourceTopology, name: string): GeometryObject {
  const object = topology.objects[name];

  if (!object) {
    throw new Error(`The topology has no "${name}" object`);
  }

  return object;
}

function isArea(geometry: { type: string } | null): geometry is Polygon | MultiPolygon {
  return geometry?.type === "Polygon" || geometry?.type === "MultiPolygon";
}

/**
 * The polygons in one object of a topology, named by `describe`, which returns null for
 * features the map leaves out.
 */
export function readAreas({
  describe,
  detail = 0,
  object,
  source,
}: {
  describe: Describe;
  detail?: number;
  object: string;
  source: SourceName;
}): SourceArea[] {
  const topology = readTopology(source, detail);
  const collection = feature(topology, objectOf(topology, object));
  const features = "features" in collection ? collection.features : [collection];

  return features.flatMap((item) => {
    const id = String(item.id ?? "");
    const name = describe(item.properties, id);
    return name !== null && isArea(item.geometry) ? [{ geometry: item.geometry, id, name }] : [];
  });
}

/** Every polygon of an object merged into one shape, like all countries into land. */
export function readMergedLand({
  detail,
  object,
  source,
}: {
  detail: number;
  object: string;
  source: SourceName;
}): MultiPolygon {
  const topology = readTopology(source, detail);
  const collection = objectOf(topology, object);

  if (collection.type !== "GeometryCollection") {
    throw new Error(`"${object}" isn't a collection`);
  }

  const polygons = collection.geometries.filter(
    (geometry): geometry is TopoPolygon | TopoMultiPolygon =>
      geometry.type === "Polygon" || geometry.type === "MultiPolygon",
  );

  return merge(topology, polygons);
}

/** The `name` property features carry in world-atlas and us-atlas. */
export function nameProperty(properties: GeoJsonProperties): string | null {
  const name: unknown = properties?.name;
  return typeof name === "string" ? name : null;
}
