/* oxlint-disable no-magic-numbers -- Map areas are coordinates in degrees. */

/** A rectangle on the globe in degrees: longitudes run west to east, latitudes south to north. */
type GeoArea = { east: number; north: number; south: number; west: number };

type BaseMapDefinition = {
  /** What the map shows, for the writer's prompt. */
  covers: string;
  id: string;
  /**
   * Where places can go. Most maps are one rectangle; a map with insets (Alaska and Hawaii next
   * to the other states) has one per part. The player draws every part of each area.
   */
  areas: readonly GeoArea[];
};

/**
 * The checked base maps a map explorer can use. The player draws each one from public-domain
 * data (Natural Earth, the US Census Bureau) or from simplified historical outlines, so the
 * writer only picks a map and gives coordinates; it never draws a map.
 */
export const activityBaseMaps = [
  {
    areas: [{ east: 180, north: 90, south: -90, west: -180 }],
    covers: "the whole world by country",
    id: "world",
  },
  {
    areas: [{ east: 180, north: 90, south: -90, west: -180 }],
    covers: "the whole world by continent",
    id: "world-continents",
  },
  {
    areas: [{ east: 50, north: 72, south: 34, west: -25 }],
    covers: "Europe by country, from Iceland and Portugal to the Volga",
    id: "europe",
  },
  {
    areas: [{ east: -20, north: 75, south: -56, west: -170 }],
    covers: "North, Central and South America by country",
    id: "americas",
  },
  {
    areas: [{ east: 60, north: 38, south: -36, west: -26 }],
    covers: "Africa by country, with Madagascar and the islands around it",
    id: "africa",
  },
  {
    areas: [{ east: 180, north: 78, south: -11, west: 25 }],
    covers: "Asia by country, from Turkey and the Middle East to Japan and Indonesia",
    id: "asia",
  },
  {
    areas: [
      { east: -66.5, north: 49.5, south: 24, west: -125 },
      { east: -129.5, north: 71.5, south: 51, west: -180 },
      { east: -154.5, north: 22.5, south: 18.5, west: -160.5 },
    ],
    covers: "the United States by state, with Alaska and Hawaii in insets",
    id: "usa-states",
  },
  {
    areas: [{ east: -34.5, north: 5.5, south: -34, west: -74 }],
    covers: "Brazil by state, with its neighbors",
    id: "brazil-states",
  },
  {
    areas: [{ east: 50, north: 57, south: 23, west: -10 }],
    covers: "the Roman Empire at its largest, in 117 CE, with the Parthian Empire",
    id: "roman-empire-117",
  },
  {
    areas: [{ east: 45, north: 66, south: 34, west: -12 }],
    covers: "Europe's countries and empires in 1914, on the eve of the First World War",
    id: "europe-1914",
  },
  {
    areas: [{ east: -0.129, north: 51.517, south: 51.509, west: -0.144 }],
    covers:
      "the streets of Soho, London, in 1854, around the Broad Street pump from John Snow's cholera map",
    id: "london-1854",
  },
] as const satisfies readonly BaseMapDefinition[];

export type ActivityBaseMap = (typeof activityBaseMaps)[number];
export type ActivityBaseMapId = ActivityBaseMap["id"];

const byId: ReadonlyMap<string, ActivityBaseMap> = new Map(
  activityBaseMaps.map((map) => [map.id, map]),
);

export function getActivityBaseMap(id: string): ActivityBaseMap | null {
  return byId.get(id) ?? null;
}

/** Whether a point falls inside one of the map's areas, so the player can draw it there. */
export function isOnBaseMap(
  map: BaseMapDefinition,
  point: { latitude: number; longitude: number },
): boolean {
  return map.areas.some(
    (area) =>
      point.latitude >= area.south &&
      point.latitude <= area.north &&
      point.longitude >= area.west &&
      point.longitude <= area.east,
  );
}

function describeArea(area: GeoArea): string {
  return `latitude ${area.south} to ${area.north}, longitude ${area.west} to ${area.east}`;
}

/** The base maps as the writer reads them: id, what it shows and where places can go. */
export function describeBaseMaps(): string {
  return activityBaseMaps
    .map(
      (map) =>
        `"${map.id}" (${map.covers}; ${map.areas.map((area) => describeArea(area)).join(" or ")})`,
    )
    .join(", ");
}
