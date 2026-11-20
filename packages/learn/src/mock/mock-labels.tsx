"use client";

import { type MockShape, type MockView } from "@zoonk/core/exams/mocks/contract";
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

/** The button that marks an answer the learner isn't sure of, and that mark wherever it shows. */
export function useUnsureLabel() {
  const t = useExtracted();

  return t({
    description:
      "A toggle button in a mock exam: marks the current answer as one the learner isn't sure of, to check before handing in. Its label stays the same when pressed.",
    message: "Not sure",
  });
}

/** The small mark beside a question or an answer the learner marked "Not sure". */
export function UnsureMark({ className }: { className?: string }) {
  return <BookmarkIcon aria-hidden="true" className={cn("size-3 fill-current", className)} />;
}

/** A one-subject mock exam is told apart by its subject; a full or half one needs no label. */
export function getMockSubject({ shape }: { shape: MockShape | null }): string {
  return shape?.kind === "area" ? (shape.area ?? "") : "";
}
