"use client";

import { CHARACTER_ACTS, type CharacterAct } from "@/design-system/characters";
import { BUDDY_ACTS } from "@zoonk/ui/components/buddy-actor";
import { TRICKSTER_ACTS } from "@zoonk/ui/components/trickster-actor";
import { cn } from "@zoonk/ui/lib/utils";
import { renderCode } from "../../_components/doc";

function getFrames(act: CharacterAct): number {
  return act.character === "buddy" ? BUDDY_ACTS[act.act].frames : TRICKSTER_ACTS[act.act].frames;
}

const CHARACTER_NAMES: Record<CharacterAct["character"], string> = {
  buddy: "Buddy",
  trickster: "Trickster",
};

const FRAME_MS = 1000 / 24;

const COLUMNS = "lg:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)]";
const ROW = "grid gap-x-6 gap-y-1 border-t py-3 text-sm leading-6";

export function ActsTable() {
  return (
    <div className="flex flex-col" role="table">
      <div className={cn("text-faint hidden gap-x-6 pb-2 text-xs lg:grid", COLUMNS)} role="row">
        <span role="columnheader">Act</span>
        <span role="columnheader">What happens</span>
        <span role="columnheader">Where it plays</span>
      </div>
      {CHARACTER_ACTS.map((act) => {
        const frames = getFrames(act);

        return (
          <div className={cn(ROW, COLUMNS)} key={`${act.character}-${act.act}`} role="row">
            <span className="flex flex-col" role="rowheader">
              <span className="font-medium">{act.name}</span>
              <span className="text-muted-foreground text-xs">
                {CHARACTER_NAMES[act.character]}
              </span>
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                {frames} frames · {Math.round(frames * FRAME_MS)}ms
              </span>
            </span>
            <span role="cell">{renderCode(act.does)}</span>
            <span className="text-muted-foreground" role="cell">
              {renderCode(act.when)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
