import { LearnShell, LearnShellHeader, LearnShellMain, LearnShellStart } from "@zoonk/learn/shell";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { LearnBarEndSkeleton } from "./learn-bar-end";
import { LearnGoalMenuSkeleton } from "./learn-goal-menu";

/**
 * Holds the bars' shape while the app's frame loads: tabs on top from `lg`, below under it. A
 * frame's own page skeleton (`children`) takes the generic one's place.
 */
export function LearnFrameSkeleton({ children }: { children?: React.ReactNode }) {
  return (
    <LearnShell>
      <LearnShellHeader>
        <LearnShellStart>
          <LearnGoalMenuSkeleton />
        </LearnShellStart>

        <Skeleton className="col-start-2 row-start-1 hidden h-10 w-80 justify-self-center rounded-full lg:block" />

        <LearnBarEndSkeleton />
      </LearnShellHeader>

      <LearnShellMain>
        {children ?? (
          <>
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="mt-4 h-48 w-full rounded-2xl" />
          </>
        )}
      </LearnShellMain>

      <div className="sticky bottom-0 border-t pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="mx-auto grid h-16 max-w-md grid-cols-3 place-items-center px-2">
          <Skeleton className="h-8 w-14 rounded-full" />
          <Skeleton className="h-8 w-14 rounded-full" />
          <Skeleton className="h-8 w-14 rounded-full" />
        </div>
      </div>
    </LearnShell>
  );
}
