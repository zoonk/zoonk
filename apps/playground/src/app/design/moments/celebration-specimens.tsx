"use client";

import { type CeremonyMilestone, MilestoneCeremony } from "@zoonk/learn/ceremony";
import { MissionMoment, getAfterMissionsDelay } from "@zoonk/learn/mission-moment";
import { MomentReadouts } from "@zoonk/learn/moment-readouts";
import { LearnProvider } from "@zoonk/learn/provider";
import { ReachedMoment } from "@zoonk/learn/reached-moment";
import { StatTile, StatTiles } from "@zoonk/learn/stat-tile";
import { StepDetail, StepTitleLabel, StepTitleNumber } from "@zoonk/learn/step-card";
import { TricksterArt } from "@zoonk/learn/trickster-art";
import { Button } from "@zoonk/ui/components/button";
import { BEAT_MS } from "@zoonk/ui/lib/motion";
import { CheckIcon, MinusIcon, XIcon } from "lucide-react";
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

/** A mock's day: a review done earlier, then the mock itself, the day's last mission. */
const MOCK_DAY: MissionMomentProps["missions"] = [
  { done: 1, kind: "review", status: "done", total: 1 },
  { done: 1, kind: "mock", status: "done", total: 1 },
];

/** What the mock did to the day: it was the day's last mission, so it paid the bonus. */
const MOCK_MISSIONS = {
  completed: ["mock"],
  fullMeal: { bonus: BONUS, paid: true },
  missions: MOCK_DAY,
} satisfies Pick<MissionMomentProps, "completed" | "fullMeal" | "missions">;

const CHALLENGE_DONE: MissionMomentProps["missions"] = [
  { done: 1, kind: "review", status: "done", total: 1 },
  { done: 1, kind: "challenge", status: "done", total: 1 },
  { done: 0, kind: "practice", minutes: 6, status: "todo", total: 1 },
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
            delay={BEAT_MS}
            reached={{ energy: 80, level: { color: "yellow", level: 3 } }}
          />
        </BlockEnd>
        <div className="max-w-column flex flex-col items-start gap-6">
          <p className="text-muted-foreground text-xs">At the most Energy goes</p>
          <ReachedMoment
            buddy={BUDDY}
            ceremony={null}
            delay={BEAT_MS}
            reached={{ energy: 100, level: null }}
          />
        </div>
      </div>
    </LearnProvider>
  );
}

/**
 * A mock's end, a graded result: its score leads, named small above it, the answers it comes from
 * as tiles, then the day's moment as under a block's readouts. The title is a paragraph here, so the
 * docs keep one heading for the page.
 */
export function MockEndSpecimen() {
  return (
    <LearnProvider adapters={ADAPTERS}>
      <div className="max-w-column flex flex-col items-start gap-6">
        <div className="flex flex-col items-start gap-1.5">
          <p className="text-title flex flex-col items-start gap-1.5">
            <StepTitleLabel>Mock exam 2 done</StepTitleLabel>
            <StepTitleNumber>610–690</StepTitleNumber>
          </p>
          <StepDetail className="text-sm">Estimated score · ENEM · Natural Sciences</StepDetail>
        </div>
        {/* Side by side while their words fit, as `MockResultAnswers` lays them out. */}
        <StatTiles className="flex flex-wrap [&>li]:min-w-max [&>li]:flex-1">
          <StatTile icon={<CheckIcon />} label="Right" tone="success" value="30" />
          <StatTile icon={<XIcon />} label="Wrong" tone="danger" value="13" />
          <StatTile icon={<MinusIcon />} label="Blank" value="2" />
        </StatTiles>
        <MissionMoment buddy={BUDDY} {...MOCK_MISSIONS} />
        <ReachedMoment
          buddy={BUDDY}
          ceremony={null}
          delay={getAfterMissionsDelay(MOCK_MISSIONS)}
          reached={{ energy: 90, level: { color: "yellow", level: 4 } }}
        />
      </div>
    </LearnProvider>
  );
}

/**
 * A challenge won, as its result opens right after the duel: the Trickster tips back into his
 * beaten pose (`CheckpointResultView` does so only then), the score, then the day's moment.
 */
export function ChallengeWonSpecimen() {
  return (
    <LearnProvider adapters={ADAPTERS}>
      <div className="max-w-column flex flex-col items-start gap-6">
        <TricksterArt beaten className="animate-tip" />
        <div className="flex flex-col items-start gap-3">
          <p className="text-title">You beat the Trickster!</p>
          <MomentReadouts brainPower={0} score={{ answered: 6, correct: 5 }} />
        </div>
        <MissionMoment
          buddy={BUDDY}
          completed={["challenge"]}
          fullMeal={{ bonus: BONUS, paid: false }}
          missions={CHALLENGE_DONE}
        />
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
