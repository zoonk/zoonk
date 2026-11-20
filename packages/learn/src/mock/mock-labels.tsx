"use client";

import { type MockShape, type MockView } from "@zoonk/core/exams/mocks/contract";
import { useExtracted } from "next-intl";
import { useFormatNumber } from "../_utils/use-format-number";

export function useMockNumber() {
  const number = useFormatNumber();
  return (value: number) => number(value, { maximumFractionDigits: 2 });
}

export function useMockPercent() {
  const number = useFormatNumber();
  return (percent: number) => number(percent / 100, { maximumFractionDigits: 1, percent: true });
}

export function useMockTitle() {
  const t = useExtracted();

  return (mock: Pick<MockView, "number">) =>
    t("Mock exam {number}", { number: String(mock.number) });
}

/** A one-subject mock exam is told apart by its subject; a full or half one needs no label. */
export function getMockSubject({ shape }: { shape: MockShape | null }): string {
  return shape?.kind === "area" ? (shape.area ?? "") : "";
}
