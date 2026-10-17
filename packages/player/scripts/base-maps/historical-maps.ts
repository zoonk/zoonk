import { composeRegions } from "./compose-regions";
import { EUROPE_1914_LABELS, EUROPE_1914_RULES, EUROPE_1914_TRANSFERS } from "./europe-1914";
import {
  centeredOn,
  intersect,
  parsePoints,
  polygonShape,
  rectangleShape,
  subtract,
  toGeometry,
} from "./geo-ops";
import { SOHO_1854_SQUARES, SOHO_1854_STREETS } from "./london-1854";
import { COUNTRIES_50M, DETAIL, areaOf, countries, landWithin, widen } from "./map-helpers";
import { type MapSource } from "./render-map";
import { PARTHIAN_EMPIRE, ROMAN_EMPIRE_117, ROMAN_LABELS } from "./roman-empire";

/** How far the Soho map's land reaches past its area, in degrees: about a kilometer. */
const SOHO_MARGIN = 0.01;

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** The middle of a small outline, as a label position. */
function centerOf(polygon: string): string {
  const points = parsePoints(polygon);
  const [longitude, latitude] = [points.map((point) => point[0]), points.map((point) => point[1])];

  return `${average(longitude)} ${average(latitude)}`;
}

export function romanMap(): MapSource {
  const area = areaOf("roman-empire-117");
  const land = landWithin(area);
  const roman = intersect(land, polygonShape(ROMAN_EMPIRE_117));
  const parthian = subtract(intersect(land, polygonShape(PARTHIAN_EMPIRE)), roman);

  return {
    fit: { area, kind: "area" },
    labels: ROMAN_LABELS,
    legend: [
      { key: "romanEmpire", tone: "groupB" },
      { key: "parthianEmpire", tone: "groupA" },
    ],
    maxZoom: 4,
    projection: { kind: "azimuthalEqualArea", rotate: centeredOn("20 40") },
    regions: [
      {
        geometry: toGeometry(subtract(land, roman, parthian)),
        id: "other",
        name: "Other peoples",
        tone: "context",
      },
      {
        geometry: toGeometry(parthian),
        id: "parthianEmpire",
        name: "Parthian Empire",
        tone: "groupA",
      },
      { geometry: toGeometry(roman), id: "romanEmpire", name: "Roman Empire", tone: "groupB" },
    ],
  };
}

export function europe1914Map(): MapSource {
  const area = areaOf("europe-1914");

  return {
    fit: { area, kind: "area" },
    labels: EUROPE_1914_LABELS,
    legend: [
      { key: "tripleEntente", tone: "groupA" },
      { key: "tripleAlliance", tone: "groupB" },
    ],
    maxZoom: 4,
    projection: { kind: "azimuthalEqualArea", rotate: centeredOn("16 50") },
    regions: composeRegions({
      areas: countries(COUNTRIES_50M, DETAIL.region),
      rules: EUROPE_1914_RULES,
      transfers: EUROPE_1914_TRANSFERS,
      within: rectangleShape(widen(area)),
    }),
  };
}

export function londonMap(): MapSource {
  const area = areaOf("london-1854");

  return {
    fit: { area, kind: "area" },
    labels: SOHO_1854_SQUARES.map((square) => ({
      key: null,
      position: centerOf(square.polygon),
      text: square.name,
    })),
    maxZoom: 2,
    projection: { kind: "mercator" },
    regions: [
      {
        geometry: toGeometry(rectangleShape(widen(area, SOHO_MARGIN))),
        id: "soho",
        name: "Soho",
        tone: "context",
      },
      ...SOHO_1854_SQUARES.map((square) => ({
        geometry: toGeometry(polygonShape(square.polygon)),
        id: square.id,
        name: square.name,
        tone: "groupC" as const,
      })),
    ],
    streets: SOHO_1854_STREETS.map((street) => ({
      coordinates: parsePoints(street.coordinates),
      isLabelled: street.isLabelled,
      name: street.name,
    })),
  };
}
