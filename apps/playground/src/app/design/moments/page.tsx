import { MOMENTS, MOMENT_RULES } from "@/design-system/moments";
import { BrainPowerReward } from "@zoonk/learn/brain-power-reward";
import { MissionsRing } from "@zoonk/learn/missions-ring";
import { Buddy } from "@zoonk/ui/components/buddy";
import { type Metadata } from "next";
import { PreviewIntlProvider } from "../../preview/preview-intl-provider";
import {
  DevOnlySpecimen,
  DocHeader,
  DocRules,
  DocSection,
  Specimen,
  renderCode,
} from "../_components/doc";
import { MotionSpecimen } from "../_components/motion-specimen";
import {
  CeremonySpecimen,
  ChallengeWonSpecimen,
  MissionDoneSpecimen,
  MissionsCompleteSpecimen,
  MockEndSpecimen,
  ReachedSpecimen,
  TaskEndSpecimen,
} from "./celebration-specimens";

export const metadata: Metadata = { title: "Special moments" };

const REWARD_POINTS = 50;
const BRAIN_POWER = 1240;
const MISSIONS_TOTAL = 3;

function BuddyInRing({ done }: { done: number }) {
  return (
    <MissionsRing
      className="size-16"
      missions={{ done, total: MISSIONS_TOTAL }}
      moment={false}
      strokeWidth={2.5}
    >
      <Buddy
        beltColor="yellow"
        className="size-12"
        crop="face"
        energy={80}
        kind="zu"
        studiedToday
      />
    </MissionsRing>
  );
}

function MissionsSpecimen() {
  return (
    <DevOnlySpecimen>
      <div className="flex flex-col gap-10">
        <MissionsCompleteSpecimen />
        <MissionsChips />
      </div>
    </DevOnlySpecimen>
  );
}

/** Today's missions card's reward and the buddy's ring, before and after every mission is done. */
function MissionsChips() {
  return (
    <div className="flex flex-wrap items-center gap-10">
      <div className="flex items-center gap-4">
        <BuddyInRing done={1} />
        <BrainPowerReward brainPower={BRAIN_POWER} earned={false} points={REWARD_POINTS} />
        <span className="text-muted-foreground text-xs">Still to do</span>
      </div>
      <div className="flex items-center gap-4">
        <BuddyInRing done={MISSIONS_TOTAL} />
        <BrainPowerReward brainPower={BRAIN_POWER} earned points={REWARD_POINTS} />
        <span className="text-muted-foreground text-xs">Every mission done</span>
      </div>
    </div>
  );
}

/** A specimen that only renders under `pnpm dev`, like every one using next-intl's extraction. */
function devOnly(Example: () => React.ReactNode) {
  return function DevOnlyExample() {
    return (
      <DevOnlySpecimen>
        <Example />
      </DevOnlySpecimen>
    );
  };
}

/** Each moment's live specimen; the ones that move on their own replay (a ceremony opens anew). */
const SPECIMENS: Record<string, { Example: () => React.ReactNode; replays: boolean }> = {
  ceremony: { Example: devOnly(CeremonySpecimen), replays: false },
  challenge: { Example: devOnly(ChallengeWonSpecimen), replays: true },
  mission: { Example: devOnly(MissionDoneSpecimen), replays: true },
  missions: { Example: MissionsSpecimen, replays: true },
  mock: { Example: devOnly(MockEndSpecimen), replays: true },
  reached: { Example: devOnly(ReachedSpecimen), replays: true },
  "task-end": { Example: devOnly(TaskEndSpecimen), replays: true },
};

function MomentSpecimen({ id }: { id: string }) {
  const specimen = SPECIMENS[id];

  if (!specimen) {
    return null;
  }

  const { Example, replays } = specimen;
  const Frame = replays ? MotionSpecimen : Specimen;

  return (
    <Frame>
      <Example />
    </Frame>
  );
}

export default function MomentsPage() {
  return (
    <PreviewIntlProvider>
      <DocHeader title="Special moments">
        The celebrations: a few earned moments, warmer and bolder than the rest of the app, which
        stays quiet so they stand out. They are one family, built the same way, and the exception,
        never the rule.
      </DocHeader>

      <DocSection title="Rules">
        <DocRules rules={MOMENT_RULES} />
      </DocSection>

      {MOMENTS.map((moment) => (
        <DocSection id={moment.id} intro={moment.summary} key={moment.id} title={moment.title}>
          <MomentSpecimen id={moment.id} />
          <p className="text-muted-foreground text-sm">Where: {renderCode(moment.where)}</p>
        </DocSection>
      ))}
    </PreviewIntlProvider>
  );
}
