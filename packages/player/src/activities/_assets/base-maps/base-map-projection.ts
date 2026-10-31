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

export function createBaseMapProjection(spec: BaseMapProjection): GeoProjection {
  return PROJECTIONS[spec.kind](spec).scale(spec.scale).translate(spec.translate);
}

/** Returns null when the projection does not cover the place. */
export function projectPlace(
  spec: BaseMapProjection,
  place: { latitude: number; longitude: number },
): { x: number; y: number } | null {
  const point = createBaseMapProjection(spec)([place.longitude, place.latitude]);
  return point ? { x: point[0], y: point[1] } : null;
}
