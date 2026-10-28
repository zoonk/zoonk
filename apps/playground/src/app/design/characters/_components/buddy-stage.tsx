"use client";

import { type BuddyExpression } from "@zoonk/ui/components/buddy";
import { type ActorHandle, type BuddyActName, BuddyActor } from "@zoonk/ui/components/buddy-actor";
import { type BeltColor } from "@zoonk/utils/belt-level";
import { type BuddyKind } from "@zoonk/utils/buddy";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Stage, stageRate, useStageSwitches } from "./stage";

const ACTS: readonly { label: string; name: BuddyActName; start: BuddyExpression }[] = [
  { label: "Blink", name: "blink", start: "happy" },
  { label: "Glance", name: "glance", start: "happy" },
  { label: "Smile", name: "smile", start: "neutral" },
  { label: "Cheer", name: "cheer", start: "happy" },
  { label: "Surprise", name: "surprise", start: "neutral" },
  { label: "Proud", name: "proud", start: "happy" },
];

export function BuddyStage({
  beltColor,
  energy,
  kind,
  name,
}: {
  beltColor: BeltColor;
  energy: number;
  kind: BuddyKind;
  name: string;
}) {
  const actor = useRef<ActorHandle<BuddyActName>>(null);
  const switches = useStageSwitches();
  const [take, setTake] = useState<{ act: BuddyActName; id: number } | null>(null);
  const start = ACTS.find((act) => act.name === take?.act)?.start ?? "happy";
  const rate = stageRate(switches.slow);

  const playTake = useEffectEvent((act: BuddyActName) => {
    void actor.current?.play(act, { playbackRate: rate });
  });

  useEffect(() => {
    if (take) {
      playTake(take.act);
    }
  }, [take]);

  return (
    <Stage
      acts={ACTS}
      current={take?.act ?? null}
      name={name}
      onPlay={(act) => setTake((previous) => ({ act, id: (previous?.id ?? 0) + 1 }))}
      switches={switches}
    >
      <BuddyActor
        beltColor={beltColor}
        className="size-48"
        energy={energy}
        expression={start}
        key={take?.id ?? 0}
        kind={kind}
        ref={actor}
        studiedToday
      />
    </Stage>
  );
}
