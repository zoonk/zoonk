import { activityBaseMaps } from "@zoonk/core/library/activities/base-maps";
import { beforeAll, describe, expect, it } from "vitest";
import { MODULE_LOAD_TIMEOUT_MS } from "../../../_test-utils/module-load";
import { projectPlace } from "./base-map-projection";
import { getBaseMapView } from "./base-map-view";
import { loadBaseMap } from "./load-base-map";

async function loadEveryDrawing() {
  await Promise.all(activityBaseMaps.map((map) => loadBaseMap(map.id)));
}

describe("base map drawings", () => {
  beforeAll(loadEveryDrawing, MODULE_LOAD_TIMEOUT_MS);

  it.each(activityBaseMaps.map((map) => map.id))("draws every part of %s", async (id) => {
    const map = activityBaseMaps.find((item) => item.id === id);
    const drawing = await loadBaseMap(id);

    expect(drawing?.regions.length).toBeGreaterThan(0);

    for (const area of map?.areas ?? []) {
      const center = {
        latitude: (area.south + area.north) / 2,
        longitude: (area.west + area.east) / 2,
      };

      const point = drawing ? projectPlace(drawing.projection, center) : null;

      expect(point?.x).toBeGreaterThanOrEqual(0);
      expect(point?.x).toBeLessThanOrEqual(drawing?.width ?? 0);
      expect(point?.y).toBeGreaterThanOrEqual(0);
      expect(point?.y).toBeLessThanOrEqual(drawing?.height ?? 0);
    }
  });

  it("puts a place where the map's own streets are", async () => {
    const soho = await loadBaseMap("london-1854");

    const pump = soho
      ? projectPlace(soho.projection, { latitude: 51.51334, longitude: -0.13667 })
      : null;

    const broadStreet = soho?.labels.find((label) => label.text === "Broad Street");

    expect(pump && broadStreet && Math.abs(pump.y - broadStreet.y)).toBeLessThan(40);
  });

  it("resolves an unknown map to nothing", async () => {
    await expect(loadBaseMap("paris-1789")).resolves.toBeNull();
  });
});

describe(getBaseMapView, () => {
  beforeAll(loadEveryDrawing, MODULE_LOAD_TIMEOUT_MS);

  it("draws the map with each place where the drawing puts it", async () => {
    const pump = { id: "pump", latitude: 51.51334, longitude: -0.13667 };
    const soho = await loadBaseMap("london-1854");
    const view = await getBaseMapView({ baseMapId: "london-1854", places: [pump] });
    const projected = soho ? projectPlace(soho.projection, pump) : null;

    expect(view?.regions).toStrictEqual(soho?.regions);
    expect(view).not.toHaveProperty("projection");
    expect(view?.places).toStrictEqual([{ id: "pump", x: projected?.x, y: projected?.y }]);
  });

  it("leaves out a place its projection doesn't cover", async () => {
    const view = await getBaseMapView({
      baseMapId: "usa-states",
      places: [
        { id: "kansas", latitude: 38.5, longitude: -98 },
        { id: "paris", latitude: 48.86, longitude: 2.35 },
      ],
    });

    expect(view?.places.map((place) => place.id)).toStrictEqual(["kansas"]);
  });

  it("has no view of an unknown map", async () => {
    await expect(getBaseMapView({ baseMapId: "paris-1789", places: [] })).resolves.toBeNull();
  });
});
