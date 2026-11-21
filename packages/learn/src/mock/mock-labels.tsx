"use client";

import { type MockShape, type MockView } from "@zoonk/core/exams/mocks/contract";
import { type MockSectionView } from "@zoonk/core/exams/mocks/view-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { BookmarkIcon } from "lucide-react";
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

export function useUnsureLabel() {
  const t = useExtracted();

  return t({
    description:
      "A toggle button in a mock exam: marks the current answer as one the learner isn't sure of, to check before handing in. Its label stays the same when pressed.",
    message: "Not sure",
  });
}

export function UnsureMark({ className }: { className?: string }) {
  return <BookmarkIcon aria-hidden="true" className={cn("size-3 fill-current", className)} />;
}

/** A fact on a line of facts: its words sit on the line's baseline, as the others do, and its mark centers on them. */
export function UnsureFact({ className }: { className?: string }) {
  const label = useUnsureLabel();

  return (
    <span className={cn("text-warning-text inline-flex items-baseline gap-1", className)}>
      <UnsureMark className="self-center" />
      {label}
    </span>
  );
}

export function useMockSectionTitle() {
  const t = useExtracted();

  return (section: MockSectionView) =>
    section.name ?? t("Section {number, number}", { number: section.index + 1 });
}

export function useMockQuestionLabel() {
  const t = useExtracted();

  return ({ area, number, total }: { area?: string | null; number: number; total: number }) => {
    const place = { number: String(number), total: String(total) };

    return area
      ? t("Question {number} of {total} · {area}", { ...place, area })
      : t("Question {number} of {total}", place);
  };
}

/** A one-subject mock exam is told apart by its subject; a full or half one needs no label. */
export function getMockSubject({ shape }: { shape: MockShape | null }): string {
  return shape?.kind === "area" ? (shape.area ?? "") : "";
}
