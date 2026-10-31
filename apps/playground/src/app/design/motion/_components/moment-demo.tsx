"use client";

import { CountUp } from "@zoonk/ui/components/count-up";
import { ZapIcon } from "lucide-react";
import { BeltTicks, ENERGY_NOW, EnergyMeter, LevelBadge, beat, percent, plus } from "./demo-parts";

const EARNED = 27;

const LEVEL_BEAT_MS = 250;
const ENERGY_BEAT_MS = 500;

function ReachedRow({
  bar,
  detail,
  mark,
  title,
}: {
  bar: React.ReactNode;
  detail: string;
  mark: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-2 py-3">
      <span className="flex items-center gap-3">
        {mark}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-medium">{title}</span>
          <span className="text-muted-foreground text-xs">{detail}</span>
        </span>
      </span>
      {bar}
    </div>
  );
}

function Readouts() {
  return (
    <p className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
      <span className="text-muted-foreground text-sm font-medium">
        <span className="text-readout text-foreground text-[2.5rem]">4</span> of 5 right
      </span>
      <span className="text-muted-foreground text-sm font-medium">
        <CountUp
          className="text-readout text-brain-text text-[2.5rem]"
          format={plus}
          value={EARNED}
        />{" "}
        Brain Power
      </span>
    </p>
  );
}

export function MomentDemo() {
  return (
    <div className="flex max-w-md flex-col gap-4">
      <div className="flex flex-col gap-3">
        <p className="text-title">Lesson complete</p>
        <Readouts />
      </div>

      <div className="divide-y">
        <ReachedRow
          bar={<BeltTicks delayMs={LEVEL_BEAT_MS} />}
          detail="Orange belt, level 4"
          mark={<LevelBadge delayMs={LEVEL_BEAT_MS} />}
          title="Level up!"
        />
        <ReachedRow
          bar={<EnergyMeter />}
          detail="Right answers raise it. A day away lowers it a little."
          mark={
            <span aria-hidden="true" className="flex size-8 items-center justify-center">
              <ZapIcon className="text-energy animate-pop size-5" style={beat(ENERGY_BEAT_MS)} />
            </span>
          }
          title={`Energy at ${percent(ENERGY_NOW)}`}
        />
      </div>
    </div>
  );
}
