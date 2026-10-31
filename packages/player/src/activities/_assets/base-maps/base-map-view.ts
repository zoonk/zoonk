import { z } from "zod";
import { baseMapDrawingSchema } from "./base-map-drawing";
import { projectPlace } from "./base-map-projection";
import { loadBaseMap } from "./load-base-map";

export const baseMapViewSchema = baseMapDrawingSchema
  .omit({ projection: true })
  .extend({
    places: z
      .array(z.object({ id: z.string(), x: z.number(), y: z.number() }))
      .meta({ description: "Each place the map covers, at its spot in the drawing's units" }),
  });

export type BaseMapView = z.infer<typeof baseMapViewSchema>;

/**
 * The base map a map activity's places sit on, with each place projected onto it, so an app draws
 * it without its own copy of the drawings or their projections. Null for an unknown map.
 */
export async function getBaseMapView({
  baseMapId,
  places,
}: {
  baseMapId: string;
  places: readonly { id: string; latitude: number; longitude: number }[];
}): Promise<BaseMapView | null> {
  const drawing = await loadBaseMap(baseMapId);

  if (!drawing) {
    return null;
  }

  const { projection, ...shapes } = drawing;

  return {
    ...shapes,
    places: places.flatMap((place) => {
      const point = projectPlace(projection, place);
      return point ? [{ id: place.id, ...point }] : [];
    }),
  };
}
