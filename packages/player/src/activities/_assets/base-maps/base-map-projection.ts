import {
  type GeoProjection,
  geoAlbersUsa,
  geoAzimuthalEqualArea,
  geoConicEqualArea,
  geoEqualEarth,
  geoMercator,
} from "d3-geo";
import { type BaseMapProjection } from "./base-map-drawing";

const NO_ROTATION: [number, number, number] = [0, 0, 0];

const PROJECTIONS: Record<BaseMapProjection["kind"], (spec: BaseMapProjection) => GeoProjection> = {
  albersUsa: () => geoAlbersUsa(),
  azimuthalEqualArea: (spec) => geoAzimuthalEqualArea().rotate(spec.rotate ?? NO_ROTATION),
  conicEqualArea: (spec) => {
    const conic = geoConicEqualArea().rotate(spec.rotate ?? NO_ROTATION);
    return spec.parallels ? conic.parallels(spec.parallels) : conic;
  },
  equalEarth: (spec) => geoEqualEarth().rotate(spec.rotate ?? NO_ROTATION),
  mercator: (spec) => geoMercator().rotate(spec.rotate ?? NO_ROTATION),
};

/**
 * The d3 projection a base map was drawn with. The build script (`scripts/base-maps`) and the
 * player both create it here, so a place's coordinates land exactly where the map's shapes put
 * them.
 */
export function createBaseMapProjection(spec: BaseMapProjection): GeoProjection {
  return PROJECTIONS[spec.kind](spec).scale(spec.scale).translate(spec.translate);
}

/** Where a place sits on the map, or null when the projection doesn't cover it. */
export function projectPlace(
  spec: BaseMapProjection,
  place: { latitude: number; longitude: number },
): { x: number; y: number } | null {
  const point = createBaseMapProjection(spec)([place.longitude, place.latitude]);
  return point ? { x: point[0], y: point[1] } : null;
}
