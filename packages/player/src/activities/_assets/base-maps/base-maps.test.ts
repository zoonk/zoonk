import { activityBaseMaps } from "@zoonk/core/library/activities/base-maps";
import { describe, expect, it } from "vitest";
import { projectPlace } from "./base-map-projection";
import { loadBaseMap } from "./load-base-map";

describe("base map drawings", () => {
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
