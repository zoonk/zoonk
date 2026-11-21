"use client";

import { EarIcon, EarOffIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { StepWayOut } from "./step-way-out";

/** The way around listening, under the step on the column, where a speaking screen has "I can't talk now". */
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
