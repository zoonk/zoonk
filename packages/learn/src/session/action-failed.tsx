"use client";

import { useExtracted } from "next-intl";
import { ChangeSaveError } from "../_components/save-error";

export function NextStepFailed() {
  const t = useExtracted();
  return <ChangeSaveError>{t("We couldn't open the next step. Try again.")}</ChangeSaveError>;
}

export function StopFailed() {
  const t = useExtracted();
  return <ChangeSaveError>{t("We couldn't stop for today. Try again.")}</ChangeSaveError>;
}
