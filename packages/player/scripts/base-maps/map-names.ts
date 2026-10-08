import { type BaseMapRegionTone } from "../../src/activities/_assets/base-maps/base-map-drawing";
import { type Continent } from "./continents";

/** Brazil's states by their two-letter codes, as Natural Earth lists them. */
export const BRAZIL_STATES: Readonly<Record<string, string>> = {
  AC: "Acre",
  AL: "Alagoas",
  AM: "Amazonas",
  AP: "Amapá",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MG: "Minas Gerais",
  MS: "Mato Grosso do Sul",
  MT: "Mato Grosso",
  PA: "Pará",
  PB: "Paraíba",
  PE: "Pernambuco",
  PI: "Piauí",
  PR: "Paraná",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RO: "Rondônia",
  RR: "Roraima",
  RS: "Rio Grande do Sul",
  SC: "Santa Catarina",
  SE: "Sergipe",
  SP: "São Paulo",
  TO: "Tocantins",
};

/** Neighboring continents never share a tone, so every border between them shows. */
export const CONTINENT_TONES: Record<Continent, BaseMapRegionTone> = {
  africa: "groupC",
  antarctica: "context",
  asia: "groupB",
  europe: "groupA",
  northAmerica: "groupA",
  oceania: "groupC",
  southAmerica: "groupB",
};

export const CONTINENT_LABELS = [
  { key: "africa", position: "20 5", text: "Africa" },
  { key: "antarctica", position: "20 -80", text: "Antarctica" },
  { key: "asia", position: "95 48", text: "Asia" },
  { key: "europe", position: "22 53", text: "Europe" },
  { key: "northAmerica", position: "-102 45", text: "North America" },
  { key: "oceania", position: "134 -25", text: "Oceania" },
  { key: "southAmerica", position: "-60 -12", text: "South America" },
] as const satisfies readonly { key: string; position: string; text: string }[];
