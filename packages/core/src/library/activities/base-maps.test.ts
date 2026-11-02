import { describe, expect, it } from "vitest";
import { getActivityBaseMap, isOnBaseMap } from "./base-maps";

function mapOf(id: string) {
  const map = getActivityBaseMap(id);

  if (!map) {
    throw new Error(`Missing base map ${id}`);
  }

  return map;
}

describe(isOnBaseMap, () => {
  it("accepts places inside any of a map's areas, including its insets", () => {
    const usa = mapOf("usa-states");

    expect(isOnBaseMap(usa, { latitude: 40.71, longitude: -74.01 })).toBe(true);
    expect(isOnBaseMap(usa, { latitude: 21.31, longitude: -157.86 })).toBe(true);
    expect(isOnBaseMap(usa, { latitude: 61.22, longitude: -149.9 })).toBe(true);
  });

  it("rejects places the map doesn't draw", () => {
    expect(isOnBaseMap(mapOf("usa-states"), { latitude: 19.43, longitude: -99.13 })).toBe(false);
    expect(isOnBaseMap(mapOf("brazil-states"), { latitude: 48.86, longitude: 2.35 })).toBe(false);
  });
});

describe(getActivityBaseMap, () => {
  it("returns null for a map the player can't draw", () => {
    expect(getActivityBaseMap("paris-1789")).toBeNull();
  });
});
