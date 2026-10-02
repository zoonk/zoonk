import {
  type ActivityBaseMapId,
  getActivityBaseMap,
} from "@zoonk/core/library/activities/base-maps";
import { type BaseMapDrawing, baseMapDrawingSchema } from "./base-map-drawing";

type JsonModule = { default: unknown };

/** One chunk per map, so a lesson downloads only the map it shows. */
const DRAWINGS: Record<ActivityBaseMapId, () => Promise<JsonModule>> = {
  africa: () => import("./generated/africa.json"),
  americas: () => import("./generated/americas.json"),
  asia: () => import("./generated/asia.json"),
  "brazil-states": () => import("./generated/brazil-states.json"),
  europe: () => import("./generated/europe.json"),
  "europe-1914": () => import("./generated/europe-1914.json"),
  "london-1854": () => import("./generated/london-1854.json"),
  "roman-empire-117": () => import("./generated/roman-empire-117.json"),
  "usa-states": () => import("./generated/usa-states.json"),
  world: () => import("./generated/world.json"),
  "world-continents": () => import("./generated/world-continents.json"),
};

const loaded = new Map<string, Promise<BaseMapDrawing | null>>();

async function loadDrawing(id: ActivityBaseMapId): Promise<BaseMapDrawing | null> {
  const json = await DRAWINGS[id]();
  const parsed = baseMapDrawingSchema.safeParse(json.default);
  return parsed.success ? parsed.data : null;
}

/**
 * A base map's drawing, loaded once per page and shared by every activity that shows it. The
 * promise is stable, so components can read it with `use` under Suspense. Unknown ids (which
 * the validator rejects before publishing) resolve to null.
 */
export function loadBaseMap(id: string): Promise<BaseMapDrawing | null> {
  const cached = loaded.get(id);

  if (cached) {
    return cached;
  }

  const map = getActivityBaseMap(id);
  const promise = map ? loadDrawing(map.id) : Promise.resolve(null);
  loaded.set(id, promise);
  return promise;
}
