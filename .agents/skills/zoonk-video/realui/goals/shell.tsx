import {
  type FollowedRunProps,
  GenerationFollowerProvider,
} from "@repo/packages/learn/src/generation/generation-follower.tsx";
// Shared phone frame for the goal screens: the learn adapters, the tab root's top bar and the bottom tabs.
import { LearnProvider } from "@repo/packages/learn/src/learn-provider.tsx";
import { GoalSwitcher } from "@repo/packages/learn/src/shell/goal-switcher.tsx";
import {
  LearnBottomNavigation,
  type LearnTab,
} from "@repo/packages/learn/src/shell/learn-navigation.tsx";
import {
  LearnShell,
  LearnShellContent,
  LearnShellMain,
} from "@repo/packages/learn/src/shell/learn-shell.tsx";
import { type ComponentProps } from "react";
import { ADAPTERS, StudioTabBar } from "../learn/common";
import { story, type Lang } from "../story";

export const NOOP = () => {};
export const NOOP_ASYNC = async () => null;

function Follower({ children }: FollowedRunProps) {
  return children({ failure: null, status: "following", steps: {} });
}

export function Learn({ children }: { children: React.ReactNode }) {
  return (
    <LearnProvider adapters={ADAPTERS}>
      <GenerationFollowerProvider follower={Follower}>{children}</GenerationFollowerProvider>
    </LearnProvider>
  );
}

export type GoalKey = "exam" | "language" | "career" | "learn";

export function switcherGoals(lang: Lang): ComponentProps<typeof GoalSwitcher>["goals"] {
  const s = story[lang];
  return [
    {
      dailyMinutes: s.exam.minutesPerDay,
      displayName: s.exam.title,
      id: "exam",
      kind: "exam",
      status: "active",
      targetDate: s.exam.date,
      languageFlag: null,
      targetDateEstimated: false,
      targetRegion: null,
      targetLanguage: null,
    },
    {
      dailyMinutes: 20,
      displayName: s.language.title,
      id: "language",
      kind: "language",
      status: "active",
      targetDate: null,
      languageFlag: null,
      targetDateEstimated: false,
      targetRegion: null,
      targetLanguage: s.language.target,
    },
    {
      dailyMinutes: s.career.minutesPerDay,
      displayName: s.career.title,
      id: "career",
      kind: "learn",
      status: "active",
      targetDate: s.career.date,
      languageFlag: null,
      targetDateEstimated: false,
      targetRegion: null,
      targetLanguage: null,
    },
  ];
}

export const DEFAULT_BUDDY_VIEW = {
  beltColor: "yellow",
  energy: 82,
  glasses: "round",
  kind: "zu",
  name: null,
  studiedToday: true,
} as const;

export function TopBar({ goal, lang }: { goal: GoalKey; lang: Lang }) {
  return (
    <StudioTabBar
      color="yellow"
      level={4}
      switcher={
        <GoalSwitcher
          activeGoalId={goal}
          explanationHref="/explain"
          exploreHref="/courses"
          goals={switcherGoals(lang)}
          hasAccount
          newGoalHref="/start"
          onSelect={async () => true}
          onStartWaiting={async () => true}
          placement="bar"
          waitingGoals={[]}
        />
      }
    />
  );
}

/**
 * The learn frame as a phone shows it: the top bar on a tab's own page, the page, then the tabs.
 * `bar` replaces the top bar (a pushed page brings its own `LearnPageBar` inside `children`).
 */
export function AppFrame({
  buddy = DEFAULT_BUDDY_VIEW,
  children,
  goal = "exam",
  lang,
  missions = { done: 1, total: 3 },
  tab,
  topBar = true,
}: {
  buddy?: ComponentProps<typeof LearnBottomNavigation>["buddy"];
  children: React.ReactNode;
  goal?: GoalKey;
  lang: Lang;
  missions?: { done: number; total: number } | null;
  tab: LearnTab | null;
  topBar?: boolean;
}) {
  return (
    <Learn>
      <LearnShell className="overflow-x-clip">
        <LearnShellContent>
          {topBar && <TopBar goal={goal} lang={lang} />}
          <LearnShellMain>{children}</LearnShellMain>
          <LearnBottomNavigation
            activeTab={tab}
            buddy={buddy}
            missions={missions}
            onSearch={() => {}}
          />
        </LearnShellContent>
      </LearnShell>
    </Learn>
  );
}
