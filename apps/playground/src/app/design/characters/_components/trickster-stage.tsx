"use client";

import { type TricksterExpression } from "@zoonk/ui/components/trickster";
import {
  type ActorHandle,
  type TricksterActName,
  TricksterActor,
} from "@zoonk/ui/components/trickster-actor";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Stage, stageRate, useStageSwitches } from "./stage";

type Take = "blink" | "defeat" | "smug" | "smugThenDefeat";

const ACTS: readonly { label: string; name: Take; start: TricksterExpression }[] = [
  { label: "Blink", name: "blink", start: "sly" },
  { label: "Smug", name: "smug", start: "sly" },
  { label: "Defeated", name: "defeat", start: "smug" },
  { label: "Smug, then defeated", name: "smugThenDefeat", start: "sly" },
];

/** The pause between smug and defeated in the sequence, at full speed. */
const BEAT_BETWEEN_MS = 700;

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function perform(actor: ActorHandle<TricksterActName>, take: Take, rate: number) {
  if (take !== "smugThenDefeat") {
    await actor.play(take, { playbackRate: rate });
    return;
  }

  await actor.play("smug", { playbackRate: rate });
  await wait(BEAT_BETWEEN_MS / rate);
  await actor.play("defeat", { playbackRate: rate });
}

/** The Trickster on his stage: smug, defeated, or one after the other. */
export function TricksterStage() {
  const actor = useRef<ActorHandle<TricksterActName>>(null);
  const switches = useStageSwitches();
  const [take, setTake] = useState<{ act: Take; id: number } | null>(null);
  const start = ACTS.find((act) => act.name === take?.act)?.start ?? "sly";
  const rate = stageRate(switches.slow);

  // Only a new take plays, at the speed the switch shows when it starts.
  const playTake = useEffectEvent((act: Take) => {
    if (actor.current) {
      void perform(actor.current, act, rate);
    }
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
      name="The Trickster"
      onPlay={(act) => setTake((previous) => ({ act, id: (previous?.id ?? 0) + 1 }))}
      switches={switches}
    >
      <TricksterActor className="size-52" expression={start} key={take?.id ?? 0} ref={actor} />
    </Stage>
  );
}
