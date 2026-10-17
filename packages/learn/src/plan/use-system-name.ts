"use client";

import { type ToolSystem } from "@zoonk/core/plans/tools-contract";
import { useExtracted } from "next-intl";

/** Devices by the names people know them by; `phone` is a phone with no computer. */
export function useSystemName() {
  const t = useExtracted();

  const names: Record<ToolSystem, string> = {
    chromebook: t("Chromebook"),
    linux: t("Linux"),
    macos: t("macOS"),
    phone: t("Phone only"),
    windows: t("Windows"),
  };

  return (system: ToolSystem) => names[system];
}
