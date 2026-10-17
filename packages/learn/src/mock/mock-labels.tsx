"use client";

import { type MockPurpose, type MockShape, type MockView } from "@zoonk/core/exams/mocks/contract";
import { useExtracted } from "next-intl";

export function useMockTitle() {
  const t = useExtracted();

  return (mock: Pick<MockView, "number">) =>
    t("Mock exam {number}", { number: String(mock.number) });
}

/**
 * What a mock sat, in a few words, beside its number: the subject, half the exam or all of it for
 * one taken any time, the starting point for one taken in onboarding; empty for the plan's own.
 */
export function useMockShapeLabel() {
  const t = useExtracted();

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

    return shape.kind === "half" ? t("Half the exam") : t("Full exam");
  };
}
