"use client";

import { type ActivityBaseMapId } from "@zoonk/core/library/activities/base-maps";
import { useExtracted } from "next-intl";

/**
 * Names drawn on base maps and in their legends, translated. Street names stay as they were
 * written at the time, like "Broad Street".
 */
export function useBaseMapLabels(): (key: string | null, text: string) => string {
  const t = useExtracted();

  const labels: Readonly<Record<string, string>> = {
    africa: t("Africa"),
    antarctica: t("Antarctica"),
    asia: t("Asia"),
    austriaHungary: t("Austria-Hungary"),
    europe: t("Europe"),
    france: t("France"),
    germanEmpire: t("German Empire"),
    italy: t("Italy"),
    northAmerica: t("North America"),
    oceania: t("Oceania"),
    ottomanEmpire: t("Ottoman Empire"),
    parthianEmpire: t("Parthian Empire"),
    romanEmpire: t("Roman Empire"),
    russianEmpire: t("Russian Empire"),
    serbia: t("Serbia"),
    southAmerica: t("South America"),
    spain: t("Spain"),
    tripleAlliance: t("Triple Alliance"),
    tripleEntente: t("Triple Entente"),
    unitedKingdom: t("United Kingdom"),
  };

  return function labelText(key, text) {
    return key ? (labels[key] ?? text) : text;
  };
}

/** What each base map shows, for the map's caption and its text alternative. */
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
    "roman-empire-117": t("Map of the Roman Empire in 117 CE"),
    "usa-states": t("Map of the United States by state"),
    world: t("World map"),
    "world-continents": t("World map of the continents"),
  };

  return function mapName(id) {
    return names[id];
  };
}

/** Maps drawn from simplified outlines say so, so nobody takes their borders as exact. */
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
