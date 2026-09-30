"use client";

import { type MockView } from "@zoonk/core/exams/mocks/contract";
import { useExtracted } from "next-intl";
import { Checklist } from "../_components/checklist";

/** What a mock's "Before you start" list asks for, one routine step at a time. */
function useChecklistItemLabel() {
  const t = useExtracted();

  return (item: MockView["checklist"][number]): string => {
    switch (item) {
      case "phoneOnSilent":
        return t("Phone on silent");
      case "clearDesk":
        return t("Clear desk");
      case "clockInView":
        return t("Clock in view");
      case "waterAndSnack":
        return t("Water and a snack");
      default:
        return t("Water and a snack");
    }
  };
}

/**
 * Rehearsing exam day before a mock: water, phone, desk and clock. It never blocks starting;
 * it's there to practice the routine, not to test it.
 */
export function ExamDayChecklist({ items }: { items: MockView["checklist"] }) {
  const t = useExtracted();
  const label = useChecklistItemLabel();

  return (
    <Checklist
      className="border-border in-data-[mode=fun]:fun-glass rounded-3xl border p-4"
      items={items}
      label={label}
      listClassName="grid grid-cols-1 sm:grid-cols-2"
      title={t("Before you start")}
    />
  );
}
