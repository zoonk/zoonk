"use client";

import { type CeremonyMilestone, MilestoneCeremony } from "@zoonk/learn/ceremony";
import { MomentReadouts } from "@zoonk/learn/moment-readouts";
import { LearnProvider } from "@zoonk/learn/provider";
import { DayMoment, StepWithDayMoment } from "@zoonk/learn/session/day-moment";
import { MomentSaving } from "@zoonk/learn/session/moment-header";
import { StatTile, StatTiles } from "@zoonk/learn/stat-tile";
import {
  StepCard,
  StepDetail,
  StepHeader,
  StepTitleLabel,
  StepTitleNumber,
} from "@zoonk/learn/step-card";
import { TricksterArt } from "@zoonk/learn/trickster-art";
import { Button } from "@zoonk/ui/components/button";
import { CheckIcon, MinusIcon, XIcon } from "lucide-react";
import { useState } from "react";

type DayMomentProps = React.ComponentProps<typeof DayMoment>;
type MissionMomentView = NonNullable<DayMomentProps["missionMoment"]>;
type LearnBuddy = NonNullable<DayMomentProps["buddy"]>;

const BUDDY: LearnBuddy = {
  beltColor: "yellow",
  energy: 80,
  glasses: "round",
  kind: "zu",
  name: null,
  studiedToday: true,
};

const BONUS = 50;

function ignore() {
  // Nothing to record.
}

const ADAPTERS: React.ComponentProps<typeof LearnProvider>["adapters"] = {
  analytics: { track: ignore },
  linkComponent: ({ children, className, href }) => (
    <a className={className} href={href}>
      {children}
    </a>
  ),
  routes: { buddy: "#", journey: "#", signUp: "#", today: "#", upgrade: "#" },
};

const NOTHING_REACHED: DayMomentProps["reached"] = { energy: null, level: null };

const ONE_DONE: MissionMomentView["missions"] = [
  { done: 1, kind: "review", status: "done", total: 1 },
  { done: 1, kind: "somethingNew", status: "done", total: 1 },
  { done: 0, kind: "practice", minutes: 6, status: "todo", total: 1 },
];

const ALL_DONE: MissionMomentView["missions"] = [
  { done: 1, kind: "review", status: "done", total: 1 },
  { done: 1, kind: "somethingNew", status: "done", total: 1 },
  { done: 1, kind: "practice", status: "done", total: 1 },
];

const MOCK_DAY: MissionMomentView["missions"] = [
  { done: 1, kind: "review", status: "done", total: 1 },
  { done: 1, kind: "mock", status: "done", total: 1 },
];

const MOCK_MISSIONS: MissionMomentView = {
  completed: ["mock"],
  fullMeal: { bonus: BONUS, paid: true },
  missions: MOCK_DAY,
};

const PRACTICE_MISSIONS: MissionMomentView = {
  completed: ["fixMistake"],
  fullMeal: { bonus: BONUS, paid: false },
  missions: [
    { done: 1, kind: "review", status: "done", total: 1 },
    { done: 2, kind: "fixMistake", status: "done", total: 2 },
    { done: 0, kind: "somethingNew", minutes: 8, status: "todo", total: 1 },
  ],
};

const CHALLENGE_DONE: MissionMomentView["missions"] = [
  { done: 1, kind: "review", status: "done", total: 1 },
  { done: 1, kind: "challenge", status: "done", total: 1 },
  { done: 0, kind: "practice", minutes: 6, status: "todo", total: 1 },
];

function BlockEnd({ children, title }: { children?: React.ReactNode; title: string }) {
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

function Variant({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-xs">{children}</p>;
}

function PracticeEnd() {
  return (
    <div className="max-w-column flex flex-col items-start gap-6">
      <StepHeader>
        <p className="text-title">Practice done</p>
        <StepDetail>The rest come back another day, when they stick better.</StepDetail>
      </StepHeader>
      <MomentReadouts
        brainPower={24}
        facts={["2 mistakes fixed"]}
        score={{ answered: 5, correct: 4 }}
      />
      <DayMoment
        buddy={BUDDY}
        ceremony={null}
        missionMoment={PRACTICE_MISSIONS}
        reached={{ energy: 70, level: null }}
      />
    </div>
  );
}

export function TaskEndSpecimen() {
  return (
    <LearnProvider adapters={ADAPTERS}>
      <div className="flex flex-col gap-10">
        <BlockEnd title="Lesson complete" />
        <div className="flex flex-col gap-3">
          <Variant>With a line under its title and a fact on the mono line</Variant>
          <PracticeEnd />
        </div>
        <div className="flex flex-col gap-3">
          <Variant>While it saves</Variant>
          <div className="max-w-column flex flex-col items-start gap-6">
            <p className="text-title">Lesson complete</p>
            <MomentSaving />
          </div>
        </div>
      </div>
    </LearnProvider>
  );
}

export function MissionDoneSpecimen() {
  return (
    <LearnProvider adapters={ADAPTERS}>
      <BlockEnd title="Lesson complete">
        <DayMoment
          buddy={BUDDY}
          ceremony={null}
          missionMoment={{
            completed: ["somethingNew"],
            fullMeal: { bonus: BONUS, paid: false },
            missions: ONE_DONE,
          }}
          reached={NOTHING_REACHED}
        />
      </BlockEnd>
    </LearnProvider>
  );
}

export function MissionsCompleteSpecimen() {
  return (
    <LearnProvider adapters={ADAPTERS}>
      <BlockEnd title="Practice done">
        <DayMoment
          buddy={BUDDY}
          ceremony={null}
          missionMoment={{
            completed: ["practice"],
            fullMeal: { bonus: BONUS, paid: true },
            missions: ALL_DONE,
          }}
          reached={NOTHING_REACHED}
        />
      </BlockEnd>
    </LearnProvider>
  );
}

function TestEnd() {
  return (
    <div className="max-w-column">
      <StepWithDayMoment
        dayMoment={
          <DayMoment
            buddy={BUDDY}
            ceremony={null}
            missionMoment={null}
            reached={{ energy: 60, level: null }}
          />
        }
      >
        <StepCard>
          <StepHeader>
            <p className="text-title">You already know this</p>
            <StepDetail>3 lessons are off your plan.</StepDetail>
          </StepHeader>
          <MomentReadouts brainPower={0} facts={["4 of 5 right"]} />
        </StepCard>
      </StepWithDayMoment>
    </div>
  );
}

export function ReachedSpecimen() {
  return (
    <LearnProvider adapters={ADAPTERS}>
      <div className="flex flex-col gap-10">
        <BlockEnd title="Review done">
          <DayMoment
            buddy={BUDDY}
            ceremony={null}
            missionMoment={null}
            reached={{ energy: 80, level: { color: "yellow", level: 3 } }}
          />
        </BlockEnd>
        <div className="flex flex-col gap-3">
          <Variant>Energy alone, where the work earns only Energy (a test)</Variant>
          <TestEnd />
        </div>
        <div className="max-w-column flex flex-col items-start gap-3">
          <Variant>At the most Energy goes</Variant>
          <DayMoment
            buddy={BUDDY}
            ceremony={null}
            missionMoment={null}
            reached={{ energy: 100, level: null }}
          />
        </div>
      </div>
    </LearnProvider>
  );
}

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
        <StatTiles className="flex flex-wrap [&>li]:min-w-max [&>li]:flex-1">
          <StatTile icon={<CheckIcon />} label="Right" tone="success" value="30" />
          <StatTile icon={<XIcon />} label="Wrong" tone="danger" value="13" />
          <StatTile icon={<MinusIcon />} label="Blank" value="2" />
        </StatTiles>
        <DayMoment
          buddy={BUDDY}
          ceremony={null}
          missionMoment={MOCK_MISSIONS}
          reached={{ energy: 90, level: { color: "yellow", level: 4 } }}
        />
      </div>
    </LearnProvider>
  );
}

export function ChallengeWonSpecimen() {
  return (
    <LearnProvider adapters={ADAPTERS}>
      <div className="max-w-column flex flex-col items-start gap-6">
        <TricksterArt beaten reacts />
        <div className="flex flex-col items-start gap-3">
          <p className="text-title">You beat the Trickster!</p>
          <MomentReadouts brainPower={0} score={{ answered: 6, correct: 5 }} />
        </div>
        <DayMoment
          buddy={BUDDY}
          ceremony={null}
          missionMoment={{
            completed: ["challenge"],
            fullMeal: { bonus: BONUS, paid: false },
            missions: CHALLENGE_DONE,
          }}
          reached={NOTHING_REACHED}
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
