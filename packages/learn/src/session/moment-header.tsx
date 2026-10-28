"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useEffect, useRef } from "react";
import { StepDetail, StepHeader } from "../_components/step-card";
import { TASK_MAIN_ACTION_CLASS } from "../_components/task-layout";
import { isFocusLost } from "../_utils/is-focus-lost";
import { MOMENT_TITLE_PROPS } from "./moment-ceremony";

export function MomentHeader({
  children,
  detail,
  eyebrow,
  title,
}: {
  children?: React.ReactNode;
  detail?: React.ReactNode;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (isFocusLost(document.activeElement)) {
      heading.current?.focus({ preventScroll: true });
    }
  }, []);

  return (
    <div className="flex flex-col items-start gap-6" data-slot="moment-header" role="status">
      <StepHeader>
        {eyebrow}
        <h2 className="text-title outline-none" ref={heading} {...MOMENT_TITLE_PROPS}>
          {title}
        </h2>
        {detail && <StepDetail className="text-pretty">{detail}</StepDetail>}
      </StepHeader>

      {children}
    </div>
  );
}

export function MomentSaving() {
  const t = useExtracted();

  return <p className="text-muted-foreground shimmer text-sm">{t("Saving your progress…")}</p>;
}

export function PendingMainAction({ children }: { children: React.ReactNode }) {
  return (
    <Button aria-busy className={TASK_MAIN_ACTION_CLASS} disabled focusableWhenDisabled size="xl">
      {children}
    </Button>
  );
}
