import { type MultiPolygon } from "geojson";
import { type BaseMapRegionTone } from "../../src/activities/_assets/base-maps/base-map-drawing";
import {
  type Shape,
  intersect,
  polygonShape,
  subtract,
  toGeometry,
  toShape,
  unionAll,
} from "./geo-ops";
import { type SourceArea } from "./geo-sources";

export type RegionRule = {
  id: string;
  members: readonly string[];
  name: string;
  tone: BaseMapRegionTone;
};

/** Only listed sources transfer land; coarse polygons may extend beyond them. */
export type Transfer = {
  owner: string;
  /** "longitude latitude" pairs, like "5.8 49.6, 6.8 49.2". */
  polygon: string;
  sources: readonly string[];
};

export type ComposedRegion = {
  geometry: MultiPolygon;
  id: string;
  name: string;
  tone: BaseMapRegionTone;
};

function shapesOf(areas: ReadonlyMap<string, Shape>, names: readonly string[]): Shape[] {
  return names.flatMap((name) => {
    const shape = areas.get(name);
    return shape ? [shape] : [];
  });
}

export function composeRegions({
  areas,
  rules,
  transfers,
  within,
}: {
  areas: readonly SourceArea[];
  rules: readonly RegionRule[];
  transfers: readonly Transfer[];
  within: Shape;
}): ComposedRegion[] {
  const shapes = new Map(
    areas
      .map((area) => [area.name, intersect(toShape(area.geometry), within)] as const)
      .filter(([, shape]) => shape.length > 0),
  );

  const pieces = transfers.map((transfer) => ({
    owner: transfer.owner,
    shape: intersect(polygonShape(transfer.polygon), unionAll(shapesOf(shapes, transfer.sources))),
  }));

  const piecesOf = (owner: string, isOwner: boolean) =>
    pieces.filter((piece) => (piece.owner === owner) === isOwner).map((piece) => piece.shape);

  const ruled = rules.map((rule) => ({
    id: rule.id,
    name: rule.name,
    shape: unionAll([
      subtract(unionAll(shapesOf(shapes, rule.members)), ...piecesOf(rule.id, false)),
      ...piecesOf(rule.id, true),
    ]),
    tone: rule.tone,
  }));

  const named = new Set(rules.flatMap((rule) => rule.members));
  const moved = pieces.map((piece) => piece.shape);

  const rest = areas
    .filter((area) => !named.has(area.name) && shapes.has(area.name))
    .map((area) => ({
      id: area.id,
      name: area.name,
      shape: subtract(shapes.get(area.name) ?? [], ...moved),
      tone: "context" as const,
    }));

  return [...ruled, ...rest]
    .filter((region) => region.shape.length > 0)
    .map((region) => ({
      geometry: toGeometry(region.shape),
      id: region.id,
      name: region.name,
      tone: region.tone,
    }));
}
