"use client";

import { EarIcon, EarOffIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { StepWayOut } from "./step-way-out";

/** The way around a question asked by ear, as "I can't talk now" is for one said out loud. */
export function CantListenSwitch({
  cantListen,
  onChange,
}: {
  cantListen: boolean;
  onChange: (cantListen: boolean) => void;
}) {
  const t = useExtracted();

  return (
    <StepWayOut
      icon={cantListen ? <EarIcon aria-hidden="true" /> : <EarOffIcon aria-hidden="true" />}
      onClick={() => onChange(!cantListen)}
    >
      {cantListen ? t("I can listen now") : t("I can't listen now")}
    </StepWayOut>
  );
}
