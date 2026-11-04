// The ceremony when the buddy grows (Young at the Orange belt); `ceremony=belt|glasses` shows the other moments.
import { MilestoneCeremony } from "@repo/packages/learn/src/ceremonies/milestone-ceremony.tsx";
import { getBeltStartBrainPower } from "@repo/packages/utils/src/belt-level.ts";
import { useEffect } from "react";
import { type Lang } from "../story";
import { buddyStatus, tabBuddy } from "./buddy-energy";
import { Learn, NOOP } from "./shell";

const MILESTONES = {
  belt: { id: "belt-orange", key: "orange", kind: "belt" },
  glasses: { id: "glasses-star", key: "star", kind: "glasses" },
  stage: { id: "stage-young", key: "young", kind: "buddyStage" },
} as const;

/** A tap opened it on a phone, so its autofocused button shows no keyboard ring. */
function DropFocusRing() {
  useEffect(() => {
    const timer = setTimeout(() => (document.activeElement as HTMLElement | null)?.blur(), 200);
    return () => clearTimeout(timer);
  }, []);
  return null;
}

export function BuddyGrew({ lang, q }: { lang: Lang; q: URLSearchParams }) {
  const ceremony = (q.get("ceremony") ?? "stage") as keyof typeof MILESTONES;
  const milestone = MILESTONES[ceremony] ?? MILESTONES.stage;
  const bp = ceremony === "glasses" ? 4340 : getBeltStartBrainPower("orange");
  const buddy = tabBuddy(buddyStatus({ bp, energy: 90, lang, studied: true }));

  return (
    <Learn>
      <MilestoneCeremony buddy={buddy as any} milestone={milestone as any} onShown={NOOP} />
      <DropFocusRing />
    </Learn>
  );
}
