"use client";

import { Label } from "@zoonk/ui/components/label";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { RadioGroup, RadioGroupItem } from "@zoonk/ui/components/radio-group";
import { CircleCheckIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ExperienceMode } from "../experience-mode";

const OPTION_CLASS =
  "border-border has-data-checked:border-foreground has-focus-visible:ring-ring/50 in-data-[mode=fun]:fun-glass in-data-[mode=fun]:has-data-checked:border-fun-lime flex cursor-pointer flex-col items-stretch gap-3 rounded-2xl border p-3 has-focus-visible:ring-[3px]";

/** A calm list: a title, a status line and a dark Continue button. */
function FocusPreview() {
  return (
    <div
      aria-hidden="true"
      className="flex h-28 flex-col gap-1.5 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900"
    >
      <span className="h-2.5 w-2/3 rounded-full bg-neutral-800 dark:bg-neutral-200" />
      <span className="h-1.5 w-1/2 rounded-full bg-neutral-300 dark:bg-neutral-600" />
      <span className="mt-1 h-1.5 w-full rounded-full bg-neutral-200 dark:bg-neutral-700" />
      <span className="h-1.5 w-5/6 rounded-full bg-neutral-200 dark:bg-neutral-700" />
      <span className="mt-auto h-3.5 w-full rounded-full bg-neutral-900 dark:bg-neutral-100" />
    </div>
  );
}

/** Deep space, a planet, colorful stops and a lime button, drawn with Fun's own tokens. */
function FunPreview() {
  return (
    <div
      aria-hidden="true"
      className="fun-space relative flex h-28 flex-col gap-1.5 overflow-hidden rounded-xl p-3"
      data-mode="fun"
    >
      <span className="fun-planet absolute -top-3 -right-3 size-12" />
      <span className="bg-fun-fg h-2.5 w-1/2 rounded-full" />
      <div className="mt-2 grid grid-cols-3 gap-1">
        <span className="fun-card fun-card-cyan h-4 rounded-md" />
        <span className="fun-card fun-card-emerald h-4 rounded-md" />
        <span className="fun-card fun-card-pink h-4 rounded-md" />
      </div>
      <span className="bg-fun-lime mt-auto h-3.5 w-full rounded-full" />
    </div>
  );
}

function ModeOption({ mode }: { mode: ExperienceMode }) {
  const t = useExtracted();

  return (
    <Label className={OPTION_CLASS}>
      {mode === "fun" ? <FunPreview /> : <FocusPreview />}

      <span className="flex items-start justify-between gap-2">
        <span className="flex flex-col gap-0.5">
          <span className="text-base font-semibold">{mode === "fun" ? t("Fun") : t("Focus")}</span>
          <span className="text-muted-foreground text-xs font-normal">
            {mode === "fun"
              ? t("With a buddy, missions and challenges")
              : t("Calm and direct, just the essentials")}
          </span>
        </span>
        <RadioGroupItem className="mt-0.5 size-5 shrink-0" value={mode} />
      </span>
    </Label>
  );
}

/** Focus or Fun. Switching is instant and changes nothing about the plan or progress. */
export function ModePicker({
  mode,
  onChange,
}: {
  mode: ExperienceMode;
  onChange: (mode: ExperienceMode) => void;
}) {
  const t = useExtracted();

  return (
    <div className="flex flex-col gap-3">
      <RadioGroup
        aria-label={t("Mode")}
        className="grid grid-cols-2 gap-3"
        onValueChange={(value) => onChange(value === "fun" ? "fun" : "focus")}
        value={mode}
      >
        <ModeOption mode="focus" />
        <ModeOption mode="fun" />
      </RadioGroup>

      <p className="text-muted-foreground flex items-start gap-2 text-sm">
        <LineMarker aria-hidden="true">
          <CircleCheckIcon className="text-success size-4" />
        </LineMarker>
        {t("Switching doesn't change your plan or progress.")}
      </p>
    </div>
  );
}
