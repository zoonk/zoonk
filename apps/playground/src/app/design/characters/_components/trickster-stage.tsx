"use client";

import { type TricksterExpression } from "@zoonk/ui/components/trickster";
import {
  type ActorHandle,
  type TricksterActName,
  TricksterActor,
} from "@zoonk/ui/components/trickster-actor";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Stage, stageRate, useStageSwitches } from "./stage";

type Take = "blink" | "defeat" | "sly" | "smug" | "smugWithSign" | "smugThenDefeat";

/** Each take, the face it starts from, and whether he holds his sign, as at a challenge's intro. */
const ACTS: readonly { label: string; name: Take; sign?: boolean; start: TricksterExpression }[] = [
  { label: "Blink", name: "blink", start: "sly" },
  { label: "Smug", name: "smug", start: "sly" },
  { label: "Smug, with his sign", name: "smugWithSign", sign: true, start: "sly" },
  { label: "Back to sly", name: "sly", start: "smug" },
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
  if (take === "smugThenDefeat") {
    await actor.play("smug", { playbackRate: rate });
    await wait(BEAT_BETWEEN_MS / rate);
    await actor.play("defeat", { playbackRate: rate });
    return;
  }

  await actor.play(take === "smugWithSign" ? "smug" : take, { playbackRate: rate });
}

/** The Trickster on his stage: smug (with his sign too), back to sly, defeated, or smug then defeated. */
export function TricksterStage() {
  const actor = useRef<ActorHandle<TricksterActName>>(null);
  const switches = useStageSwitches();
  const [take, setTake] = useState<{ act: Take; id: number } | null>(null);
  const shown = ACTS.find((act) => act.name === take?.act);
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
      <TricksterActor
        className="size-52"
        expression={shown?.start ?? "sly"}
        key={take?.id ?? 0}
        pose={shown?.sign ? "hero" : "sly"}
        ref={actor}
      />
    </Stage>
  );
}
