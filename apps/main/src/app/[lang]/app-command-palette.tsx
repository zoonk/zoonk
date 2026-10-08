import { CommandPalette } from "@/app/[lang]/(catalog)/_components/command-palette";
import { switchGoalAction } from "@/app/[lang]/(learn)/_components/switch-goal-action";
import { type GoalView } from "@zoonk/core/goals/contract";
import { listCurrentUserGoals } from "@zoonk/core/goals/list-current-user";
import { getSession } from "@zoonk/core/users/session";
import { logError } from "@zoonk/utils/logger";
import { unstable_rethrow } from "next/navigation";

/** The viewer's session and goals; null for a visitor, or when they can't be read. */
async function loadPaletteViewer() {
  try {
    const session = await getSession();

    if (!session) {
      return null;
    }

    return { list: await listCurrentUserGoals(), session };
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
    goals: listed.filter((goal) => goal.kind !== "explain").map(({ id, title }) => ({ id, title })),
  };
}

/**
 * Cmd/Ctrl+K from anywhere in the app for anyone with a session (the tabs, settings, the catalog,
 * course pages and full-screen tasks), with their places and their other goals. Visitors get one
 * only in the app's frame, so public pages never load it. It sits in the root layout, above every
 * error page, so a failed lookup leaves the palette out instead of failing the page.
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
        ...toPaletteGoals(viewer.list?.goals ?? []),
        onSwitchGoal: switchGoalAction,
      }}
    />
  );
}
