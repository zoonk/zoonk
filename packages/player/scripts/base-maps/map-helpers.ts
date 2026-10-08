import {
  type ActivityBaseMapId,
  getActivityBaseMap,
} from "@zoonk/core/library/activities/base-maps";
import { geoBounds } from "d3-geo";
import { type GeoRectangle, intersect, rectangleShape, toShape } from "./geo-ops";
import {
  type SourceArea,
  type SourceName,
  nameProperty,
  readAreas,
  readMergedLand,
} from "./geo-sources";

export const COUNTRIES_110M: SourceName = "countries110m";
export const COUNTRIES_50M: SourceName = "countries50m";
export const US_STATES: SourceName = "usStates10m";
export const SOUTH_AMERICA_50M: SourceName = "southAmerica50m";

/** Land around a regional map, so its corners never show empty sea where land should be. */
const MARGIN = 20;
const WORLD_EAST = 180;
const WORLD_NORTH = 90;

/**
 * How much each source is simplified (see `readAreas`): continents drop more points than a
 * country-sized map, which the learner may zoom into.
 */
export const DETAIL = { continent: 2e-6, country: 2e-7, region: 4e-7 } as const;

/** The map's first area in core's catalog, which the projection is fitted to. */
export function areaOf(id: ActivityBaseMapId): GeoRectangle {
  const area = getActivityBaseMap(id)?.areas[0];

  if (!area) {
    throw new Error(`No area for base map ${id}`);
  }

  return area;
}

export function widen(area: GeoRectangle, margin = MARGIN): GeoRectangle {
  return {
    east: Math.min(area.east + margin, WORLD_EAST),
    north: Math.min(area.north + margin, WORLD_NORTH),
    south: Math.max(area.south - margin, -WORLD_NORTH),
    west: Math.max(area.west - margin, -WORLD_EAST),
  };
}

export function countries(source: SourceName, detail = 0): SourceArea[] {
  return readAreas({
    describe: (properties) => nameProperty(properties),
    detail,
    object: "countries",
    source,
  });
}

/** Whether an area reaches into a rectangle; shapes across the antimeridian always count. */
export function reaches(area: SourceArea, rectangle: GeoRectangle): boolean {
  const [[west, south], [east, north]] = geoBounds(area.geometry);
  const crossesAntimeridian = west > east;

  return (
    south <= rectangle.north &&
    north >= rectangle.south &&
    (crossesAntimeridian || (west <= rectangle.east && east >= rectangle.west))
  );
}

/** All land around a map's area, as one shape, for maps drawn over the coastline. */
export function landWithin(area: GeoRectangle) {
  const land = readMergedLand({
    detail: DETAIL.region,
    object: "countries",
    source: COUNTRIES_50M,
  });

  return intersect(toShape(land), rectangleShape(widen(area)));
}
