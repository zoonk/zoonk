import { CommandPalette } from "@/app/[lang]/(app)/(catalog)/_components/command-palette";
import {
  type LearnerPlaces,
  NO_PLACES,
  type TodayQueue,
  getLearnerPlaces,
  getTodayQueue,
} from "@/app/[lang]/(app)/(learn)/_components/learner-places";
import { switchGoalAction } from "@/app/[lang]/(app)/(learn)/_components/switch-goal-action";
import { type GoalView } from "@zoonk/core/goals/contract";
import { listCurrentUserGoals } from "@zoonk/core/goals/list-current-user";
import { DEFAULT_BUDDY, type ResolvedBuddy } from "@zoonk/core/profile/default-buddy";
import { getLearningProfile } from "@zoonk/core/profile/get";
import { getSession } from "@zoonk/core/users/session";
import { logError } from "@zoonk/utils/logger";
import { unstable_rethrow } from "next/navigation";

/**
 * One part of the palette's data (today's next block, the goal's places, the buddy's name): one
 * that can't be read is left out, not the palette.
 */
async function readPart<Value>({
  fallback,
  read,
}: {
  fallback: Value;
  read: () => Promise<Value>;
}): Promise<Value> {
  try {
    return await read();
  } catch (error) {
    // Next's own signals (dynamic rendering, redirects) must keep propagating.
    unstable_rethrow(error);
    logError("Command palette part failed to load", { error });
    return fallback;
  }
}

/** The same resolved identity the buddy tab shows, with its own name unless renamed. */
async function getBuddy(): Promise<ResolvedBuddy> {
  const profile = await getLearningProfile();
  return profile?.buddy ?? DEFAULT_BUDDY;
}

/** The viewer's session and goals; null for a visitor, or when they can't be read. */
async function loadPaletteViewer() {
  try {
    const session = await getSession();

    if (!session) {
      return null;
    }

    const [list, places, today, buddy] = await Promise.all([
      listCurrentUserGoals(),
      readPart<LearnerPlaces>({ fallback: NO_PLACES, read: getLearnerPlaces }),
      readPart<TodayQueue | null>({ fallback: null, read: getTodayQueue }),
      readPart({ fallback: DEFAULT_BUDDY, read: getBuddy }),
    ]);

    return { buddy, list, places, session, today };
  } catch (error) {
    // Next's own signals (dynamic rendering, redirects) must keep propagating.
    unstable_rethrow(error);
    logError("Command palette viewer failed to load", { error });
    return null;
  }
}

/**
 * The goals the palette switches to and the quick explanations it opens (newest first): an
 * explanation has no plan for the tabs to show, and one read to the end is found again here.
 */
function toPaletteGoals(goals: GoalView[]) {
  const listed = goals.filter((goal) => goal.status !== "archived");

  return {
    explanations: listed
      .filter((goal) => goal.kind === "explain")
      .toReversed()
      .map(({ id, title }) => ({ id, title })),
    goals: listed
      .filter((goal) => goal.kind !== "explain")
      .map(({ id, kind, title }) => ({ id, kind, title })),
  };
}

/** The buddy tutors the active goal unless it's a quick explanation, as its tab does. */
function canAskBuddy(list: Awaited<ReturnType<typeof listCurrentUserGoals>>): boolean {
  const active = list?.goals.find((goal) => goal.id === list.activeGoalId);
  return Boolean(active && active.kind !== "explain");
}

/**
 * Cmd/Ctrl+K from anywhere in the app for anyone with a session (the tabs, settings, the catalog,
 * course pages and full-screen tasks), with their actions, places and other goals. Visitors get
 * one only in the app's frame, so public pages never load it. It sits in the root layout, above
 * every error page, so a failed lookup leaves the palette out instead of failing the page. Today's
 * queue is a read of the saved day shared with the sidebar, without preparing a study day.
 */
export async function AppCommandPalette() {
  const viewer = await loadPaletteViewer();

  if (!viewer) {
    return null;
  }

  return (
    <CommandPalette
      isLoggedIn={!viewer.session.user.isAnonymous}
      learner={{
        activeGoalId: viewer.list?.activeGoalId ?? null,
        buddy: viewer.buddy,
        canAskBuddy: canAskBuddy(viewer.list),
        ...toPaletteGoals(viewer.list?.goals ?? []),
        onSwitchGoal: switchGoalAction,
        places: viewer.places,
        today: viewer.today,
      }}
    />
  );
}
