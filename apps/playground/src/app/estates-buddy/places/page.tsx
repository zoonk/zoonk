"use client";

import { type CeremonyMilestone, MilestoneCeremony } from "@zoonk/learn/ceremony";
import { LearnProvider } from "@zoonk/learn/provider";
import { Buddy } from "@zoonk/ui/components/buddy";
import { Trickster } from "@zoonk/ui/components/trickster";
import { type BuddyKind } from "@zoonk/utils/buddy";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  ChallengeWonSpecimen,
  MissionDoneSpecimen,
  MissionsCompleteSpecimen,
} from "../../design/moments/celebration-specimens";
import { PreviewIntlProvider } from "../../preview/preview-intl-provider";

// Temporary page for the UX review pack (lane E): the places that draw a character whole, with
// the picture's edge drawn on the size sheet. Not for landing.

const ADAPTERS: any = {
  analytics: { track: () => null },
  linkComponent: ({ children, className, href }: any) => (
    <a className={className} href={href}>
      {children}
    </a>
  ),
  loadCountries: async () => [],
  routes: { buddy: "#", journey: "#", signUp: "#", today: "#", upgrade: "#" },
};

const CEREMONIES: Record<string, CeremonyMilestone> = {
  belt: { id: "belt", key: "black", kind: "belt" },
  glasses: { id: "glasses", key: "star", kind: "glasses" },
  stage: { id: "stage", key: "adult", kind: "buddyStage" },
};

const KINDS: readonly BuddyKind[] = ["zu", "beep", "otto", "noodle"];
const EDGE = "outline-foreground/35 outline outline-1 outline-dashed";
const SIZES = ["size-12", "size-20", "size-24", "size-40"] as const;

function Places() {
  const ceremony = CEREMONIES[useSearchParams().get("ceremony") ?? ""];

  if (ceremony) {
    return (
      <LearnProvider adapters={ADAPTERS}>
        <MilestoneCeremony
          buddy={{
            beltColor: "black",
            energy: 100,
            glasses: "round",
            kind: "zu",
            name: null,
            studiedToday: true,
          }}
          milestone={ceremony}
          onClose={() => null}
          onShown={() => null}
          onWearGlasses={async () => true}
        />
      </LearnProvider>
    );
  }

  return (
    <div className="bg-background flex flex-col gap-10 p-4">
      <section className="w-[358px]" data-sheet="mission-done">
        <MissionDoneSpecimen />
      </section>
      <section className="w-[358px]" data-sheet="missions-complete">
        <MissionsCompleteSpecimen />
      </section>
      <section className="w-[358px]" data-sheet="challenge-won">
        <ChallengeWonSpecimen />
      </section>

      <section className="flex w-[1100px] flex-col gap-6 pt-8" data-sheet="body-sizes">
        <p className="text-sm">
          The whole character, glowing, at 48, 80, 96 and 160 px. The dashed line is the edge of its
          own picture.
        </p>
        {KINDS.map((kind) => (
          <div className="flex items-end gap-8" key={kind}>
            {SIZES.map((size) => (
              <span className={EDGE} key={size}>
                <Buddy beltColor="black" className={size} energy={100} kind={kind} studiedToday />
              </span>
            ))}
            <span className={EDGE}>
              <Buddy beltColor="black" className="size-24" energy={12} kind={kind} />
            </span>
            <span className={EDGE}>
              <Buddy beltColor="white" className="size-24" energy={100} kind={kind} studiedToday />
            </span>
          </div>
        ))}
        <div className="flex items-end gap-8">
          {(["sly", "smug", "defeated"] as const).map((expression) => (
            <span className={EDGE} key={expression}>
              <Trickster className="size-28" expression={expression} pose="hero" />
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function PlacesPage() {
  return (
    <PreviewIntlProvider>
      <Suspense>
        <Places />
      </Suspense>
    </PreviewIntlProvider>
  );
}
