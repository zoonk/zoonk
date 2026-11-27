"use client";

import { NativeSelect, NativeSelectOption } from "@zoonk/ui/components/native-select";
import { RadioInput } from "@zoonk/ui/components/radio-input";
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
          "Shows the melody as music notes on five lines, rather than numbered guitar frets.",
        message: "Notes",
      }),
      value: "staff",
    },
    { label: t("Guitar frets"), value: "tab" },
  ];

  return (
    <div
      aria-label={t("Show the music as")}
      className={cn(TAB_LIST_CLASS, "-me-2.5 shrink-0")}
      role="radiogroup"
    >
      {views.map((option) => (
        <label className={cn(TAB_CLASS, "cursor-pointer")} key={option.value}>
          <RadioInput
            checked={view === option.value}
            className="absolute top-1/2 left-1/2 m-0 size-full min-h-11 min-w-11 -translate-1/2 cursor-pointer opacity-0"
            name={name}
            onChange={() => onChange(option.value)}
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
          {t("{tempo} beats/min", { tempo: String(option) })}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
