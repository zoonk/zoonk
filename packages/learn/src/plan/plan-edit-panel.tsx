"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@zoonk/ui/components/collapsible";
import { getScrollBehavior } from "@zoonk/ui/lib/scroll-behavior";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useId, useRef } from "react";
import { PlanEditRequest } from "./plan-edit-request";
import { PlanLevel } from "./plan-level";
import { PlanSchedule } from "./plan-schedule";

/** Which part of the panel to bring into view when something else opens it. */
export type PlanEditFocus = "schedule" | "words";

/**
 * Everything that shapes the plan in one place: time, study days, a light week, the learner's own
 * level and a change in plain words. Other parts of the screen open it (the Edit link, "Cover
 * less").
 */
export function PlanEditPanel({
  focus,
  onOpenChange,
  open,
}: {
  focus: PlanEditFocus;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const t = useExtracted();
  const textareaId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  // Opening from elsewhere on the screen moves attention to the panel, and to the words for "Cover less".
  useEffect(() => {
    if (!open) {
      return;
    }

    panelRef.current?.scrollIntoView({ behavior: getScrollBehavior(), block: "start" });

    if (focus === "words") {
      panelRef.current?.parentElement?.querySelector("textarea")?.focus({ preventScroll: true });
    }
  }, [focus, open]);

  return (
    <Collapsible onOpenChange={onOpenChange} open={open}>
      <div className="scroll-mt-24" ref={panelRef}>
        <CollapsibleTrigger
          className={cn(buttonVariants({ variant: "outline" }), "w-full justify-between")}
        >
          {t("Change your plan")}
          <ChevronDownIcon
            aria-hidden="true"
            className={cn(
              "transition-transform motion-reduce:transition-none",
              open && "rotate-180",
            )}
          />
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent className="flex flex-col gap-6 pt-5">
        <PlanSchedule />
        <PlanLevel />
        <PlanEditRequest textareaId={textareaId} />
      </CollapsibleContent>
    </Collapsible>
  );
}
