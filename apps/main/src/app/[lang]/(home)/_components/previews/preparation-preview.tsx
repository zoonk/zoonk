import { PREVIEW_CARD_CLASS } from "@/components/public/landing-styles";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowRightIcon, GitBranchPlusIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { getExampleMove } from "../example-move";

type NeedState = "notStarted" | "progress" | "weak";

const NEED_DOT: Record<NeedState, string> = {
  notStarted: "bg-border",
  progress: "bg-foreground",
  weak: "bg-amber-500",
};

/**
 * Preparation as it is: what's still needed for the goal, and the plan adding
 * a lesson where it's missing. It never promises a result.
 */
export async function PreparationPreview() {
  const [t, move] = await Promise.all([getExtracted(), getExampleMove()]);

  const needs: { label: string; state: NeedState; status: string }[] = [
    { label: t("Small talk at work"), state: "weak", status: t("Needs practice") },
    { label: t("Phone calls"), state: "progress", status: t("Learning") },
    { label: t("Bank and paperwork"), state: "notStarted", status: t("New") },
  ];

  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      <div className={cn(PREVIEW_CARD_CLASS, "p-4")}>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[15px] font-semibold">
            {t("{move, select, london {London preparation} other {Madrid preparation}}", { move })}
          </p>
          <p className="text-muted-foreground flex flex-none items-center gap-1 text-[13px] whitespace-nowrap tabular-nums">
            {t("34%")}
            <ArrowRightIcon className="size-3" />
            <b className="text-foreground">{t("36%")}</b>
          </p>
        </div>

        <div className="bg-muted mt-3 flex h-1.5 overflow-hidden rounded-full dark:bg-neutral-700">
          <div className="bg-foreground w-[34%]" />
          <div className="w-[2%] bg-emerald-500" />
        </div>

        <p className="text-muted-foreground mt-4 text-xs font-medium">{t("Still needed")}</p>

        <ul className="mt-1.5 flex flex-col gap-2 text-sm">
          {needs.map((need) => (
            <li className="flex items-start gap-2.5 leading-snug" key={need.label}>
              <LineMarker>
                <span className={cn("size-2 rounded-full", NEED_DOT[need.state])} />
              </LineMarker>
              <span className="min-w-0 flex-1 text-pretty">{need.label}</span>
              <LineMarker>
                <span
                  className={cn(
                    "text-xs whitespace-nowrap",
                    need.state === "weak"
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-muted-foreground",
                  )}
                >
                  {need.status}
                </span>
              </LineMarker>
            </li>
          ))}
        </ul>
      </div>

      <div className={cn(PREVIEW_CARD_CLASS, "flex gap-3 p-4")}>
        <span className="flex size-9 flex-none items-center justify-center rounded-full bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
          <GitBranchPlusIcon className="size-[18px]" />
        </span>
        <div>
          <p className="text-sm leading-tight font-medium">{t("Plan updated")}</p>
          <p className="text-muted-foreground mt-0.5 text-[13px] leading-snug">
            {t("Added the past tense. Phone calls need it.")}
          </p>
        </div>
      </div>
    </div>
  );
}
