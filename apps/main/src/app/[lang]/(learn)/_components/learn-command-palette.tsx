import { CommandPalette } from "@/app/[lang]/(catalog)/_components/command-palette";
import { listCurrentUserGoals } from "@zoonk/core/goals/list-current-user";
import { getSession } from "@zoonk/core/users/session";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { switchGoalAction } from "./switch-goal-action";

/**
 * The palette is for desktop keyboards: its button shows on large screens only, where the top bar
 * has room, and Cmd/Ctrl+K opens it anywhere. It takes the pill shape of the top bar's other
 * controls, glass in Fun.
 */
const TRIGGER_CLASS =
  "in-data-[mode=fun]:fun-glass in-data-[mode=fun]:text-fun-fg hidden size-10 rounded-full lg:inline-flex";

/** The shared Cmd/Ctrl+K palette on the learning tabs, with the learner's places and goals. */
export async function LearnCommandPalette() {
  const [session, list] = await Promise.all([getSession(), listCurrentUserGoals()]);

  return (
    <CommandPalette
      isLoggedIn={Boolean(session)}
      learner={{
        activeGoalId: list?.activeGoalId ?? null,
        goals: (list?.goals ?? []).map(({ id, title }) => ({ id, title })),
        onSwitchGoal: switchGoalAction,
      }}
      triggerClassName={TRIGGER_CLASS}
    />
  );
}

export function LearnCommandPaletteSkeleton() {
  return <Skeleton className="hidden size-10 rounded-full lg:block" />;
}
