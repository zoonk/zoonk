import { type ActivityBaseMapId } from "@zoonk/core/library/activities/base-maps";
import { composeRegions } from "./compose-regions";
import {
  CONTINENT_TRANSFERS,
  type Continent,
  continentOf,
  countriesOf,
  isOnContinents,
} from "./continents";
import { centeredOn, rectangleShape } from "./geo-ops";
import { nameProperty, readAreas } from "./geo-sources";
import { europe1914Map, londonMap, romanMap } from "./historical-maps";
import {
  COUNTRIES_110M,
  COUNTRIES_50M,
  DETAIL,
  SOUTH_AMERICA_50M,
  US_STATES,
  areaOf,
  countries,
  reaches,
  widen,
} from "./map-helpers";
import { BRAZIL_STATES, CONTINENT_LABELS, CONTINENT_TONES } from "./map-names";
import { type MapSource } from "./render-map";

const CONTINENTS: readonly Continent[] = [
  "africa",
  "antarctica",
  "asia",
  "europe",
  "northAmerica",
  "oceania",
  "southAmerica",
];

/** Alaska and Hawaii, drawn apart from the other states. */
const US_INSETS = new Set(["02", "15"]);

/** A continent's countries, with their neighbors drawn quieter. */
function regionalMap({
  continents,
  detail,
  id,
  rotate,
}: {
  continents: readonly Continent[];
  detail: number;
  id: ActivityBaseMapId;
  /** The projection's center, as d3 rotates to it: minus its longitude and latitude. */
  rotate: [number, number, number];
}): MapSource {
  const area = areaOf(id);
  const around = widen(area);

  return {
    fit: { area, kind: "area" },
    maxZoom: 4,
    projection: { kind: "azimuthalEqualArea", rotate },
    regions: countries(COUNTRIES_50M, detail)
      .filter((country) => reaches(country, around))
      .map((country) => ({
        ...country,
        tone: isOnContinents(country.name, continents) ? "focus" : "context",
      })),
  };
}

function worldMap(): MapSource {
  return {
    fit: { kind: "sphere" },
    maxZoom: 3,
    projection: { kind: "equalEarth" },
    regions: countries(COUNTRIES_110M).map((country) => ({ ...country, tone: "focus" })),
  };
}

function continentsMap(): MapSource {
  return {
    fit: { kind: "sphere" },
    labels: CONTINENT_LABELS,
    maxZoom: 2.5,
    projection: { kind: "equalEarth" },
    regions: composeRegions({
      areas: countries(COUNTRIES_110M).filter((country) => continentOf(country.name) !== null),
      rules: CONTINENTS.map((continent) => ({
        id: continent,
        members: countriesOf(continent),
        name: continent,
        tone: CONTINENT_TONES[continent],
      })),
      transfers: CONTINENT_TRANSFERS,
      /* Past 180° east, so shapes unwrapped across the antimeridian keep their far side. */
      within: rectangleShape({ east: 360, north: 90, south: -90, west: -180 }),
    }),
  };
}

function usaMap(): MapSource {
  const states = readAreas({
    describe: (properties) => nameProperty(properties),
    detail: DETAIL.country,
    object: "states",
    source: US_STATES,
  });

  const [nation] = readAreas({
    describe: () => "United States",
    detail: DETAIL.country,
    object: "nation",
    source: US_STATES,
  });

  if (!nation) {
    throw new Error("us-atlas has no nation shape");
  }

  return {
    fit: { kind: "shape", shape: nation.geometry },
    insets: states.filter((state) => US_INSETS.has(state.id)).map((state) => state.geometry),
    maxZoom: 5,
    projection: { kind: "albersUsa" },
    regions: states.map((state) => ({ ...state, tone: "focus" })),
  };
}

function brazilMap(): MapSource {
  const area = areaOf("brazil-states");
  const around = widen(area);

  const states = readAreas({
    describe: (properties, id) => (properties?.gu === "BRA" ? (BRAZIL_STATES[id] ?? id) : null),
    detail: DETAIL.country,
    object: "subunits",
    source: SOUTH_AMERICA_50M,
  });

  const neighbors = countries(COUNTRIES_50M, DETAIL.country).filter(
    (country) => country.name !== "Brazil" && reaches(country, around),
  );

  return {
    fit: { area, kind: "area" },
    maxZoom: 4,
    projection: { kind: "azimuthalEqualArea", rotate: centeredOn("-54 -14") },
    regions: [
      ...neighbors.map((country) => ({ ...country, tone: "context" as const })),
      ...states.map((state) => ({ ...state, id: `BR-${state.id}`, tone: "focus" as const })),
    ],
  };
}

/** How each base map in core's catalog is drawn. */
export const MAP_SOURCES: Record<ActivityBaseMapId, () => MapSource> = {
  africa: () =>
    regionalMap({
      continents: ["africa"],
      detail: DETAIL.continent,
      id: "africa",
      rotate: centeredOn("17 2"),
    }),
  americas: () =>
    regionalMap({
      continents: ["northAmerica", "southAmerica"],
      detail: DETAIL.continent,
      id: "americas",
      rotate: centeredOn("-95 10"),
    }),
  asia: () =>
    regionalMap({
      continents: ["asia"],
      detail: DETAIL.continent,
      id: "asia",
      rotate: centeredOn("95 35"),
    }),
  "brazil-states": brazilMap,
  europe: () =>
    regionalMap({
      continents: ["europe"],
      detail: DETAIL.region,
      id: "europe",
      rotate: centeredOn("15 52"),
    }),
  "europe-1914": europe1914Map,
  "london-1854": londonMap,
  "roman-empire-117": romanMap,
  "usa-states": usaMap,
  world: worldMap,
  "world-continents": continentsMap,
};
