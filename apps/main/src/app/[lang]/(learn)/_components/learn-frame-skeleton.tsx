import { DeviceModeRoot } from "@zoonk/learn/mode";
import {
  LearnShell,
  LearnShellEnd,
  LearnShellHeader,
  LearnShellMain,
  LearnShellStart,
} from "@zoonk/learn/shell";
import { AvatarSkeleton } from "@zoonk/ui/components/avatar";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { LearnCommandPaletteSkeleton } from "./learn-command-palette";
import { LearnGoalMenuSkeleton } from "./learn-goal-menu";

/** Holds the top bar's shape, in the mode this device keeps, while the learner's frame loads. */
export function LearnFrameSkeleton() {
  return (
    <DeviceModeRoot>
      <LearnShell>
        <LearnShellHeader column>
          <LearnShellStart>
            <LearnGoalMenuSkeleton />
          </LearnShellStart>

          <Skeleton className="col-span-2 row-start-2 h-9 w-72 rounded-full lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:justify-self-center" />

          <LearnShellEnd>
            <LearnCommandPaletteSkeleton />
            <Skeleton className="h-11 w-18 rounded-full lg:h-10" />
            <AvatarSkeleton />
          </LearnShellEnd>
        </LearnShellHeader>

        <LearnShellMain>
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="mt-4 h-48 w-full rounded-2xl" />
        </LearnShellMain>
      </LearnShell>
    </DeviceModeRoot>
  );
}
