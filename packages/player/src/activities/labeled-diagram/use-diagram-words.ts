"use client";

import { type DiagramId } from "@zoonk/core/library/activities/diagrams";
import { useExtracted } from "next-intl";
import { type DiagramLegendKey } from "../_assets/diagrams/diagram-types";
import { type SpotPosition } from "./labeled-diagram-model";

/** What each drawing shows, for the text alternative. */
export function useDiagramTitle(id: DiagramId): string {
  const t = useExtracted();

  const titles: Record<DiagramId, string> = {
    "animal-cell": t("A drawing of an animal cell"),
    atom: t("A drawing of an atom with its nucleus and electron shells"),
    "digestive-system": t("A drawing of the digestive system, from the front"),
    "earth-layers": t("A drawing of the Earth cut in half to show its layers"),
    "electric-circuit": t("A drawing of a simple electric circuit"),
    flower: t("A drawing of a flower cut in half"),
    "human-ear": t("A drawing of the ear, cut open"),
    "human-eye": t("A drawing of the eye from the side, with light coming in from the left"),
    "human-heart": t(
      "A drawing of the heart seen from the front, so its right side is on your left",
    ),
    insect: t("A drawing of an insect from above"),
    "leaf-cross-section": t("A drawing of a leaf cut across"),
    neuron: t("A drawing of a neuron"),
    plant: t("A drawing of a flowering plant, from its roots to its flower"),
    "plant-cell": t("A drawing of a plant cell"),
    "respiratory-system": t("A drawing of the respiratory system, from the front"),
    volcano: t("A drawing of a volcano cut open while it erupts"),
    "water-cycle": t("A drawing of the water cycle over the sea and land"),
  };

  return titles[id];
}

export function useLegendLabel(): (key: DiagramLegendKey) => string {
  const t = useExtracted();

  const labels: Record<DiagramLegendKey, string> = {
    oxygenPoor: t("Low in oxygen"),
    oxygenRich: t("Rich in oxygen"),
  };

  return (key) => labels[key];
}

/** Where a spot sits, so screen reader users know which part each number points at. */
export function useSpotPosition(): (position: SpotPosition) => string {
  const t = useExtracted();

  const positions: Record<SpotPosition, string> = {
    bottom: t("bottom"),
    bottomLeft: t("bottom left"),
    bottomRight: t("bottom right"),
    center: t("center"),
    left: t("left side"),
    right: t("right side"),
    top: t("top"),
    topLeft: t("top left"),
    topRight: t("top right"),
  };

  return (position) => positions[position];
}
