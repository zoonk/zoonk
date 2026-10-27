"use client";

import { CHARACTER_ACTS } from "@/design-system/characters";
import { BUDDY_ACTS } from "@zoonk/ui/components/buddy-actor";
import { TRICKSTER_ACTS } from "@zoonk/ui/components/trickster-actor";
import { cn } from "@zoonk/ui/lib/utils";
import { renderCode } from "../../_components/doc";

/** Each act's length in frames, read from the acts themselves. */
const FRAMES: Record<string, number> = {
  "Buddy Blink": BUDDY_ACTS.blink.frames,
  "Buddy Cheer": BUDDY_ACTS.cheer.frames,
  "Buddy Glance": BUDDY_ACTS.glance.frames,
  "Buddy Proud": BUDDY_ACTS.proud.frames,
  "Buddy Smile": BUDDY_ACTS.smile.frames,
  "Buddy Surprise": BUDDY_ACTS.surprise.frames,
  "Trickster Defeated": TRICKSTER_ACTS.defeat.frames,
  "Trickster Smug": TRICKSTER_ACTS.smug.frames,
};

const FRAME_MS = 1000 / 24;

const COLUMNS = "lg:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)]";
const ROW = "grid gap-x-6 gap-y-1 border-t py-3 text-sm leading-6";

/** The acts: who plays them, how long they last, what happens, and the moment each is proposed for. */
export function ActsTable() {
  return (
    <div className="flex flex-col" role="table">
      <div className={cn("text-faint hidden gap-x-6 pb-2 text-xs lg:grid", COLUMNS)} role="row">
        <span role="columnheader">Act</span>
        <span role="columnheader">What happens</span>
        <span role="columnheader">When it plays (proposed)</span>
      </div>
      {CHARACTER_ACTS.map((act) => {
        const frames = FRAMES[`${act.character} ${act.name}`] ?? 0;

        return (
          <div className={cn(ROW, COLUMNS)} key={`${act.character}-${act.name}`} role="row">
            <span className="flex flex-col" role="rowheader">
              <span className="font-medium">{act.name}</span>
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                {act.character} · {frames} frames · {Math.round(frames * FRAME_MS)}ms
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
