"use client";

import { useFormatNumber } from "@zoonk/learn/format-number";
import { useExtracted } from "next-intl";
import { type AngleUnit, fromDegrees, piFraction } from "./unit-circle-angle";

export type TrigName = "cos" | "sin" | "tan";

const VALUE_DIGITS = 2;

/** Short names as each language writes them (Portuguese and Spanish write "sen" for sine). */
export function useTrigNames(): Record<TrigName, string> {
  const t = useExtracted();
  return { cos: t("cos"), sin: t("sin"), tan: t("tan") };
}

/** Angles in the lesson's unit: 150° or, in radians, 5π/6 when it's a multiple of π people use. */
export function useFormatAngle(unit: AngleUnit) {
  const t = useExtracted();
  const format = useFormatNumber();

  return (degrees: number) => {
    if (unit === "degrees") {
      return format(degrees, { unit: "°" });
    }

    return (
      piFraction(degrees) ?? t("{value} rad", { value: format(fromDegrees(degrees, "radians")) })
    );
  };
}

/** A sine, cosine or tangent to two decimals, or a word when the tangent doesn't exist. */
export function useFormatTrig() {
  const t = useExtracted();
  const format = useFormatNumber();

  return (value: number | null) =>
    value === null ? t("undefined") : format(value, { maximumFractionDigits: VALUE_DIGITS });
}
