"use client";

import { type MockPurpose, type MockShape, type MockView } from "@zoonk/core/exams/mocks/contract";
import { useExtracted } from "next-intl";

export function useMockTitle() {
  const t = useExtracted();

  return (mock: Pick<MockView, "number">) =>
    t("Mock exam {number}", { number: String(mock.number) });
}

/** A mock sits a whole exam day or half of one, including when the exam has several days. */
export function useMockDaySizeLabel() {
  const t = useExtracted();

  return ({ day, fullLength }: { day?: number | null; fullLength: boolean }): string => {
    if (day !== undefined && day !== null) {
      return fullLength
        ? t("A full exam day, day {day}", { day: String(day) })
        : t("Half an exam day, day {day}", { day: String(day) });
    }

    return fullLength ? t("A full exam day") : t("Half an exam day");
  };
}

/**
 * What a mock sat, in a few words, beside its number: the subject, half an exam day or all of it for
 * one taken any time, the starting point for one taken in onboarding; empty for the plan's own.
 */
export function useMockShapeLabel() {
  const t = useExtracted();
  const daySize = useMockDaySizeLabel();

  return ({ purpose, shape }: { purpose: MockPurpose; shape: MockShape | null }): string => {
    if (purpose === "placement") {
      return t("Starting point");
    }

    if (!shape) {
      return "";
    }

    if (shape.kind === "area") {
      return shape.area ?? "";
    }

    return daySize({ fullLength: shape.kind === "full" });
  };
}
