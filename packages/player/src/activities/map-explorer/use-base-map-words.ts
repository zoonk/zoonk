"use client";

import { type ActivityBaseMapId } from "@zoonk/core/library/activities/base-maps";
import { useExtracted } from "next-intl";

export function useBaseMapLabels(): (key: string | null, text: string) => string {
  const t = useExtracted();

  const labels: Readonly<Record<string, string>> = {
    africa: t({
      description: "A place labeled on a map: use its usual name in your language.",
      message: "Africa",
    }),
    antarctica: t({
      description: "A place labeled on a map: use its usual name in your language.",
      message: "Antarctica",
    }),
    asia: t({
      description: "A place labeled on a map: use its usual name in your language.",
      message: "Asia",
    }),
    austriaHungary: t({
      description: "A place labeled on a map: use its usual name in your language.",
      message: "Austria-Hungary",
    }),
    europe: t({
      description: "A place labeled on a map: use its usual name in your language.",
      message: "Europe",
    }),
    france: t({
      description: "A place labeled on a map: use its usual name in your language.",
      message: "France",
    }),
    germanEmpire: t({
      description: "A place labeled on a map: use its usual name in your language.",
      message: "German Empire",
    }),
    italy: t({
      description: "A place labeled on a map: use its usual name in your language.",
      message: "Italy",
    }),
    northAmerica: t({
      description: "A place labeled on a map: use its usual name in your language.",
      message: "North America",
    }),
    oceania: t({
      description: "A place labeled on a map: use its usual name in your language.",
      message: "Oceania",
    }),
    ottomanEmpire: t({
      description: "A place labeled on a map: use its usual name in your language.",
      message: "Ottoman Empire",
    }),
    parthianEmpire: t({
      description: "A place labeled on a map: use its usual name in your language.",
      message: "Parthian Empire",
    }),
    romanEmpire: t({
      description: "A place labeled on a map: use its usual name in your language.",
      message: "Roman Empire",
    }),
    russianEmpire: t({
      description: "A place labeled on a map: use its usual name in your language.",
      message: "Russian Empire",
    }),
    serbia: t({
      description: "A place labeled on a map: use its usual name in your language.",
      message: "Serbia",
    }),
    southAmerica: t({
      description: "A place labeled on a map: use its usual name in your language.",
      message: "South America",
    }),
    spain: t({
      description: "A place labeled on a map: use its usual name in your language.",
      message: "Spain",
    }),
    tripleAlliance: t({
      description:
        "A historical alliance on a map of Europe in 1914: use its usual name in your language.",
      message: "Triple Alliance",
    }),
    tripleEntente: t({
      description:
        "A historical alliance on a map of Europe in 1914: use its usual name in your language.",
      message: "Triple Entente",
    }),
    unitedKingdom: t({
      description: "A place labeled on a map: use its usual name in your language.",
      message: "United Kingdom",
    }),
  };

  return function labelText(key, text) {
    return key ? (labels[key] ?? text) : text;
  };
}

export function useBaseMapName(): (id: ActivityBaseMapId) => string {
  const t = useExtracted();

  const names: Record<ActivityBaseMapId, string> = {
    africa: t("Map of Africa"),
    americas: t("Map of the Americas"),
    asia: t("Map of Asia"),
    "brazil-states": t("Map of Brazil by state"),
    europe: t("Map of Europe"),
    "europe-1914": t("Map of Europe in 1914"),
    "london-1854": t("Map of Soho, London, in 1854"),
    "roman-empire-117": t({
      description: "A map's name: the Roman Empire in the year 117 AD.",
      message: "Map of the Roman Empire in 117 CE",
    }),
    "usa-states": t("Map of the United States by state"),
    world: t("World map"),
    "world-continents": t("World map of the continents"),
  };

  return function mapName(id) {
    return names[id];
  };
}

export function useBaseMapNote(): (id: ActivityBaseMapId) => string | null {
  const t = useExtracted();

  const notes: Partial<Record<ActivityBaseMapId, string>> = {
    "europe-1914": t("Borders are simplified."),
    "london-1854": t("Simplified street plan, after John Snow's 1854 map."),
    "roman-empire-117": t("Borders are simplified."),
  };

  return function mapNote(id) {
    return notes[id] ?? null;
  };
}
