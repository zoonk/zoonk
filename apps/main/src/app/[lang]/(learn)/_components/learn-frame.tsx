import { UserAvatarMenu } from "@/app/[lang]/(catalog)/_components/user-avatar-menu";
import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { getExperienceMode } from "@/lib/learn/experience-mode";
import { getLearnerBuddy } from "@/lib/learn/learner-buddy";
import { getBeltLevel } from "@zoonk/core/progress/get-belt-level";
import { getEnergyLevel } from "@zoonk/core/progress/get-energy-level";
import { ModeProvider } from "@zoonk/learn/mode";
import { type LearnBuddy } from "@zoonk/learn/navigation";
import {
  LearnShell,
  LearnShellEnd,
  LearnShellHeader,
  LearnShellMain,
  LearnShellStart,
} from "@zoonk/learn/shell";
import { LearnStats, type LearnStatsView } from "@zoonk/learn/stats";
import { AvatarSkeleton } from "@zoonk/ui/components/avatar";
import { Suspense } from "react";
import { LearnCommandPalette, LearnCommandPaletteSkeleton } from "./learn-command-palette";
import { LearnGoalMenu, LearnGoalMenuSkeleton } from "./learn-goal-menu";
import { LearnTabNavigation } from "./learn-tab-navigation";

type LearnerNumbers = {
  belt: Awaited<ReturnType<typeof getBeltLevel>>;
  energy: Awaited<ReturnType<typeof getEnergyLevel>>;
};

export function toStats({ belt, energy }: LearnerNumbers): LearnStatsView {
  if (!belt) {
    return null;
  }

  return {
    belt: { color: belt.color, level: belt.level },
    brainPower: belt.totalBrainPower,
    energy: energy?.currentEnergy ?? 0,
  };
}

/**
 * Goal switcher on the left, the tabs or the dock in the center, then search (desktop), Energy and
 * the account on the right. On tablets it keeps the 600px column's edges on every learning page.
 */
function LearnTopBar({ numbers, buddy }: { numbers: LearnerNumbers; buddy: LearnBuddy | null }) {
  return (
    <LearnShellHeader column>
      <LearnShellStart>
        <Suspense fallback={<LearnGoalMenuSkeleton />}>
          <LearnGoalMenu />
        </Suspense>
      </LearnShellStart>

      <LearnTabNavigation buddy={buddy} />

      <LearnShellEnd>
        <Suspense fallback={<LearnCommandPaletteSkeleton />}>
          <LearnCommandPalette />
        </Suspense>

        <LearnStats hrefs={{ brainPower: "/level", energy: "/energy" }} stats={toStats(numbers)} />

        <Suspense fallback={<AvatarSkeleton />}>
          <UserAvatarMenu />
        </Suspense>
      </LearnShellEnd>
    </LearnShellHeader>
  );
}

/** The learning tabs' frame in the learner's mode: the top bar around one centered column. */
export async function LearnFrame({ children }: { children: React.ReactNode }) {
  const [mode, belt, energy, buddy] = await Promise.all([
    getExperienceMode(),
    getBeltLevel(),
    getEnergyLevel(),
    getLearnerBuddy(),
  ]);

  return (
    <ModeProvider experienceMode={mode}>
      <MainLearnProvider>
        <LearnShell>
          <LearnTopBar numbers={{ belt, energy }} buddy={buddy} />
          <LearnShellMain>{children}</LearnShellMain>
        </LearnShell>
      </MainLearnProvider>
    </ModeProvider>
  );
}
