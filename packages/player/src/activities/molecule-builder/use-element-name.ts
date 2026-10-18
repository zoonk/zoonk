"use client";

import { useExtracted } from "next-intl";

/** Element names for screen readers, which would otherwise read "C" as a letter. */
export function useElementName(): (element: string) => string {
  const t = useExtracted();

  const names: ReadonlyMap<string, string> = new Map([
    ["B", t("Boron")],
    ["Br", t("Bromine")],
    ["C", t("Carbon")],
    ["Cl", t("Chlorine")],
    ["F", t("Fluorine")],
    ["H", t("Hydrogen")],
    ["I", t("Iodine")],
    ["N", t("Nitrogen")],
    ["O", t("Oxygen")],
    ["P", t("Phosphorus")],
    ["S", t("Sulfur")],
    ["Si", t("Silicon")],
  ]);

  return (element) => names.get(element) ?? element;
}
