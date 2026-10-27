"use client";

import { type CeremonyMilestone, MilestoneCeremony } from "@zoonk/learn/ceremony";
import { MissionMoment } from "@zoonk/learn/mission-moment";
import { MomentReadouts } from "@zoonk/learn/moment-readouts";
import { LearnProvider } from "@zoonk/learn/provider";
import { ReachedMoment } from "@zoonk/learn/reached-moment";
import { Button } from "@zoonk/ui/components/button";
import { useState } from "react";

type MissionMomentProps = React.ComponentProps<typeof MissionMoment>;
type LearnBuddy = NonNullable<MissionMomentProps["buddy"]>;

const BUDDY: LearnBuddy = {
  beltColor: "yellow",
  energy: 80,
  glasses: "round",
  kind: "zu",
  name: null,
  studiedToday: true,
};

const BONUS = 50;

/** The docs' moments are only looked at: nothing is tracked or marked as shown. */
function ignore() {
  // Nothing to record.
}

/** The docs' links go nowhere, and nothing is tracked. */
const ADAPTERS: React.ComponentProps<typeof LearnProvider>["adapters"] = {
  analytics: { track: ignore },
  linkComponent: ({ children, className, href }) => (
    <a className={className} href={href}>
      {children}
    </a>
  ),
  routes: { buddy: "#", journey: "#", signUp: "#", today: "#", upgrade: "#" },
};

const ONE_DONE: MissionMomentProps["missions"] = [
  { done: 1, kind: "review", status: "done", total: 1 },
  { done: 1, kind: "somethingNew", status: "done", total: 1 },
  { done: 0, kind: "practice", minutes: 6, status: "todo", total: 1 },
];

const ALL_DONE: MissionMomentProps["missions"] = [
  { done: 1, kind: "review", status: "done", total: 1 },
  { done: 1, kind: "somethingNew", status: "done", total: 1 },
  { done: 1, kind: "practice", status: "done", total: 1 },
];

/** A block's end, as the session shows it: its title and readouts, then the day's moment. */
function BlockEnd({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="max-w-column flex flex-col items-start gap-6">
      <p className="text-title">{title}</p>
      <MomentReadouts
        brainPower={18}
        facts={["Review on Oct 28"]}
        score={{ answered: 4, correct: 3 }}
      />
      {children}
    </div>
  );
}

/** A mission done: the moment says what's left for the day's bonus. */
export function MissionDoneSpecimen() {
  return (
    <LearnProvider adapters={ADAPTERS}>
      <BlockEnd title="Lesson complete">
        <MissionMoment
          buddy={BUDDY}
          completed={["somethingNew"]}
          fullMeal={{ bonus: BONUS, paid: false }}
          missions={ONE_DONE}
        />
      </BlockEnd>
    </LearnProvider>
  );
}

/** The day's last mission: the whole buddy and the bonus. */
export function MissionsCompleteSpecimen() {
  return (
    <LearnProvider adapters={ADAPTERS}>
      <BlockEnd title="Practice done">
        <MissionMoment
          buddy={BUDDY}
          completed={["practice"]}
          fullMeal={{ bonus: BONUS, paid: true }}
          missions={ALL_DONE}
        />
      </BlockEnd>
    </LearnProvider>
  );
}

/** A new belt level and a new tenth of Energy, under a block's readouts. */
export function ReachedSpecimen() {
  return (
    <LearnProvider adapters={ADAPTERS}>
      <div className="flex flex-col gap-10">
        <BlockEnd title="Review done">
          <ReachedMoment
            buddy={BUDDY}
            ceremony={null}
            reached={{ energy: 80, level: { color: "yellow", level: 3 } }}
          />
        </BlockEnd>
        <div className="max-w-column flex flex-col items-start gap-6">
          <p className="text-muted-foreground text-xs">At the most Energy goes</p>
          <ReachedMoment buddy={BUDDY} ceremony={null} reached={{ energy: 100, level: null }} />
        </div>
      </div>
    </LearnProvider>
  );
}

const CEREMONIES: readonly { label: string; milestone: CeremonyMilestone }[] = [
  { label: "New belt", milestone: { id: "belt", key: "orange", kind: "belt" } },
  { label: "Buddy grows", milestone: { id: "stage", key: "young", kind: "buddyStage" } },
  { label: "New glasses", milestone: { id: "glasses", key: "star", kind: "glasses" } },
];

/** Each milestone's full-screen ceremony, opened from here and closed by its button or Escape. */
export function CeremonySpecimen() {
  const [open, setOpen] = useState<CeremonyMilestone | null>(null);

  return (
    <LearnProvider adapters={ADAPTERS}>
      <div className="flex flex-wrap gap-2">
        {CEREMONIES.map(({ label, milestone }) => (
          <Button key={milestone.id} onClick={() => setOpen(milestone)} variant="outline">
            {label}
          </Button>
        ))}
      </div>

      {open && (
        <MilestoneCeremony
          buddy={BUDDY}
          key={open.id}
          milestone={open}
          onClose={() => setOpen(null)}
          onShown={ignore}
          onWearGlasses={async () => true}
        />
      )}
    </LearnProvider>
  );
}
