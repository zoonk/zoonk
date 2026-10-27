import { MOMENTS, MOMENT_RULES } from "@/design-system/moments";
import { BrainPowerReward } from "@zoonk/learn/brain-power-reward";
import { MissionsRing } from "@zoonk/learn/missions-ring";
import { MomentReadouts } from "@zoonk/learn/moment-readouts";
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
import {
  CeremonySpecimen,
  MissionDoneSpecimen,
  MissionsCompleteSpecimen,
  MockEndSpecimen,
  ReachedSpecimen,
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

function RewardSpecimen() {
  return (
    <DevOnlySpecimen>
      <div className="flex flex-col gap-6">
        <p className="text-title">Lesson complete</p>
        <MomentReadouts
          brainPower={18}
          facts={["Review on Oct 28"]}
          score={{ answered: 4, correct: 3 }}
        />
      </div>
    </DevOnlySpecimen>
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

const SPECIMENS: Record<string, () => React.ReactNode> = {
  ceremony: devOnly(CeremonySpecimen),
  mission: devOnly(MissionDoneSpecimen),
  missions: MissionsSpecimen,
  mock: devOnly(MockEndSpecimen),
  reached: devOnly(ReachedSpecimen),
  "task-end": RewardSpecimen,
};

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

      {MOMENTS.map((moment) => {
        const Example = SPECIMENS[moment.id];

        return (
          <DocSection id={moment.id} intro={moment.summary} key={moment.id} title={moment.title}>
            {Example && (
              <Specimen>
                <Example />
              </Specimen>
            )}
            <p className="text-muted-foreground text-sm">Where: {renderCode(moment.where)}</p>
          </DocSection>
        );
      })}
    </PreviewIntlProvider>
  );
}
