"use client";

import { Button } from "@zoonk/ui/components/button";
import { Switch } from "@zoonk/ui/components/switch";
import { cn } from "@zoonk/ui/lib/utils";
import { RotateCcwIcon } from "lucide-react";
import { useId, useState } from "react";
import {
  REDUCED_CLASS,
  useDeviceReducesMotion,
  useReducedMotionCss,
} from "../../_components/reduced-motion";

const SLOW_RATE = 0.1;

export function stageRate(slow: boolean): number {
  return slow ? SLOW_RATE : 1;
}

export function useStageSwitches() {
  const device = useDeviceReducesMotion();
  const [switched, setSwitched] = useState(false);
  const [slow, setSlow] = useState(false);

  return { device, reduced: device || switched, setSlow, setSwitched, slow, switched };
}

type Switches = ReturnType<typeof useStageSwitches>;

function LabeledSwitch({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();

  return (
    <span className="flex items-center gap-2">
      <Switch checked={checked} disabled={disabled} id={id} onCheckedChange={onChange} />
      <label className="text-muted-foreground text-xs font-medium" htmlFor={id}>
        {label}
      </label>
    </span>
  );
}

export function Stage<ActName extends string>({
  acts,
  children,
  current,
  name,
  onPlay,
  switches,
}: {
  acts: readonly { label: string; name: ActName }[];
  children: React.ReactNode;
  current: ActName | null;
  name: string;
  onPlay: (act: ActName) => void;
  switches: Switches;
}) {
  const css = useReducedMotionCss();

  return (
    <section
      aria-label={name}
      className={cn(
        "ring-border flex flex-col gap-5 rounded-xl p-5 ring-1",
        switches.switched && REDUCED_CLASS,
      )}
      data-stage={name}
    >
      {switches.switched && css && <style>{css}</style>}

      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{name}</h3>
        <Button
          disabled={current === null}
          onClick={() => current && onPlay(current)}
          size="sm"
          variant="outline"
        >
          <RotateCcwIcon aria-hidden="true" />
          Replay
        </Button>
      </div>

      <div className="bg-muted/40 flex h-60 items-center justify-center rounded-lg">{children}</div>

      <div className="flex flex-wrap gap-2">
        {acts.map((act) => (
          <Button
            aria-pressed={current === act.name}
            data-act={act.name}
            key={act.name}
            onClick={() => onPlay(act.name)}
            size="sm"
            variant={current === act.name ? "default" : "outline"}
          >
            {act.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <LabeledSwitch
          checked={switches.reduced}
          disabled={switches.device}
          label="Reduced motion"
          onChange={switches.setSwitched}
        />
        <LabeledSwitch checked={switches.slow} label="10% speed" onChange={switches.setSlow} />
      </div>
    </section>
  );
}
