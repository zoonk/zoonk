"use client";

import { NativeSelect, NativeSelectOption } from "@zoonk/ui/components/native-select";
import { TAB_CLASS, TAB_LIST_CLASS } from "@zoonk/ui/components/tab-class";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { type NotationView } from "./use-abc-notation";

export function ViewToggle({
  onChange,
  view,
}: {
  onChange: (view: NotationView) => void;
  view: NotationView;
}) {
  const t = useExtracted();
  const name = useId();

  const views: { label: string; value: NotationView }[] = [
    {
      label: t({
        description:
          "Shows the notes on the five-line music staff (not sheet music) instead of guitar tab.",
        message: "Staff",
      }),
      value: "staff",
    },
    { label: t("Tab"), value: "tab" },
  ];

  return (
    <div
      aria-label={t("Show the music as")}
      className={cn(TAB_LIST_CLASS, "bg-background shrink-0 rounded-lg border p-0.5")}
      role="radiogroup"
    >
      {views.map((option) => (
        <label className={cn(TAB_CLASS, "cursor-pointer")} key={option.value}>
          <input
            checked={view === option.value}
            className="absolute inset-0 m-0 cursor-pointer opacity-0"
            name={name}
            onChange={() => onChange(option.value)}
            type="radio"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

export function TempoSelect({
  onChange,
  tempo,
  tempos,
}: {
  onChange: (tempo: number) => void;
  tempo: number;
  tempos: readonly number[];
}) {
  const t = useExtracted();

  return (
    <NativeSelect
      aria-label={t("Tempo")}
      className="shrink-0 tabular-nums"
      onChange={(event) => onChange(Number(event.target.value))}
      value={tempo}
    >
      {tempos.map((option) => (
        <NativeSelectOption key={option} value={option}>
          {t("{tempo} bpm", { tempo: String(option) })}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
