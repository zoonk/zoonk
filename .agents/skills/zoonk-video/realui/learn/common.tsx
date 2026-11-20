// The frames Main composes around the learn routes on a phone, with no-op learn adapters
// (apps/main/src/app/[lang]/(app)/(learn)/_components/learn-frame.tsx, learn-goal-menu.tsx, learn-bar-end.tsx).
import { type LearnBuddy } from "@repo/packages/learn/src/buddies/use-buddy-name.ts";
import {
  type LearnAdapters,
  type LearnLinkComponentProps,
} from "@repo/packages/learn/src/learn-context.tsx";
import { LearnProvider } from "@repo/packages/learn/src/learn-provider.tsx";
import { type MissionLinks } from "@repo/packages/learn/src/missions/mission-links.ts";
import { OnboardingPage } from "@repo/packages/learn/src/onboarding/onboarding-host.tsx";
import {
  type DayStepOpenerProps,
  DayStepOpenerProvider,
} from "@repo/packages/learn/src/session/day-step-opener.tsx";
import { type GoalKind } from "@repo/packages/learn/src/shell/goal-menu-row.tsx";
import { GoalSwitcher } from "@repo/packages/learn/src/shell/goal-switcher.tsx";
import {
  LearnBottomNavigation,
  type LearnTab,
} from "@repo/packages/learn/src/shell/learn-navigation.tsx";
import {
  FRAME_COLUMN_CLASS,
  LearnShell,
  LearnShellContent,
  LearnShellMain,
  NO_WAY_BACK,
} from "@repo/packages/learn/src/shell/learn-shell.tsx";
import { Avatar, AvatarFallback } from "@repo/packages/ui/src/components/avatar.tsx";
import { BeltIndicator } from "@repo/packages/ui/src/components/belt-indicator.tsx";
import { PageTopBar } from "@repo/packages/ui/src/components/page-top.tsx";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import { story } from "../story";

export function Link({
  href,
  children,
  onClick,
  onNavigate: _onNavigate,
  prefetch: _prefetch,
  scroll: _scroll,
  lessonWritten: _lessonWritten,
  unstable_dynamicOnHover: _dynamicOnHover,
  ref,
  ...rest
}: LearnLinkComponentProps) {
  return (
    <a
      {...rest}
      href={href}
      ref={ref}
      onClick={(e) => {
        e.preventDefault();
        onClick?.(e);
      }}
    >
      {children}
    </a>
  );
}

export const noop = () => {};

/** Where a mission's button goes; a still never follows one. */
export const MISSION_LINKS: MissionLinks = {
  hrefs: {
    areaPractice: (areaId) => `/practice/${areaId}`,
    buddy: "/buddy",
    call: (chapterId) => `/call/${chapterId}`,
    mistakesPractice: "/mistakes/practice",
    mockChooser: "/mock/new",
    pattern: (patternId) => `/pattern/${patternId}`,
    pronunciation: "/pronunciation",
  },
  openBlock: async () => true,
  openStep: async () => true,
};

/** Actions are behavior, not data: a still screen never calls them, so each is a no-op unless given. */
export function actions<T extends object>(given: Partial<T>): T {
  return new Proxy(given, {
    get: (target, key) => (key in target ? target[key as keyof T] : async () => null),
  }) as T;
}

export const ADAPTERS: LearnAdapters = {
  analytics: { track: noop },
  linkComponent: Link,
  loadCountries: async () => null,
  routes: {
    buddy: "/buddy",
    journey: "/plan",
    signUp: "/login",
    today: "/today",
    upgrade: "/subscription",
  },
};

export type ViewProps = { lang: "en" | "pt"; state: string; q: URLSearchParams };

export function S(lang: "en" | "pt") {
  return story[lang];
}

/** A still screen opens nothing; Main's WebDayStepOpenerProvider routes to the step. */
function StillOpener({ children }: DayStepOpenerProps) {
  return children(async () => true);
}

/** The learn frame on a phone during onboarding: no top bar, no tab bar. */
export function OnboardingShell({
  children,
  backHref = "/today",
}: {
  children: ReactNode;
  backHref?: string;
}) {
  return (
    <LearnProvider adapters={ADAPTERS}>
      <DayStepOpenerProvider opener={StillOpener}>
        <LearnShell className="overflow-x-clip">
          <LearnShellContent>
            <LearnShellMain>
              <OnboardingPage backHref={backHref}>{children}</OnboardingPage>
            </LearnShellMain>
          </LearnShellContent>
        </LearnShell>
      </DayStepOpenerProvider>
    </LearnProvider>
  );
}

export const CAREER_GOAL_ID = "goal-career";
export const LEARN_GOAL_ID = "goal-learn";

export const ZU: LearnBuddy = {
  beltColor: "white",
  energy: 72,
  glasses: "round",
  kind: "zu",
  name: null,
  studiedToday: false,
};

export type ShellGoal = {
  id: string;
  title: string;
  kind: GoalKind;
  dailyMinutes: number;
  targetDate: string | null;
  languageFlag?: string | null;
  targetLanguage?: string | null;
  targetRegion?: string | null;
};

/** Main's LevelLink (learn-bar-end.tsx) at level 1 on the white belt. */
function LevelLink() {
  const t = useExtracted();

  return (
    <a
      className="text-compact text-muted-foreground -ms-2 flex h-9 shrink-0 items-center px-2 whitespace-nowrap tabular-nums"
      href="/level"
    >
      <span className="flex items-center gap-1.5">
        <BeltIndicator aria-hidden="true" className="size-2.5" color="white" label="White belt" />
        <span aria-hidden="true">{t("Level {level}", { level: "1" })}</span>
      </span>
    </a>
  );
}

function TopBar({ goal }: { goal: ShellGoal }) {
  return (
    <div className={FRAME_COLUMN_CLASS} data-slot="learn-frame-bar">
      <PageTopBar
        className={NO_WAY_BACK.computer.bare}
        actions={
          <>
            <LevelLink />
            <span className="relative size-7 shrink-0 rounded-full">
              <Avatar className="size-full">
                <AvatarFallback>o</AvatarFallback>
              </Avatar>
            </span>
          </>
        }
        back={
          <GoalSwitcher
            activeGoalId={goal.id}
            explanationHref="/explain"
            exploreHref="/courses"
            goals={[
              {
                dailyMinutes: goal.dailyMinutes,
                displayName: goal.title,
                id: goal.id,
                kind: goal.kind,
                languageFlag: goal.languageFlag ?? null,
                status: "active",
                targetDate: goal.targetDate,
                targetDateEstimated: false,
                targetLanguage: goal.targetLanguage ?? null,
                targetRegion: goal.targetRegion ?? null,
              },
            ]}
            hasAccount
            newGoalHref="/start"
            onSelect={async () => true}
            onStartWaiting={async () => true}
            waitingGoals={[]}
          />
        }
      />
    </div>
  );
}

/** A tab root on a phone: what /today, /plan and /buddy draw at 390px. */
export function TabShell({
  children,
  goal,
  tab,
  buddy = ZU,
  missions = { done: 1, total: 3 },
}: {
  children: ReactNode;
  goal: ShellGoal;
  tab: LearnTab;
  buddy?: LearnBuddy;
  missions?: { done: number; total: number } | null;
}) {
  return (
    <LearnProvider adapters={ADAPTERS}>
      <DayStepOpenerProvider opener={StillOpener}>
        <LearnShell className="overflow-x-clip">
          <LearnShellContent>
            <TopBar goal={goal} />
            <LearnShellMain>{children}</LearnShellMain>
            <LearnBottomNavigation
              activeTab={tab}
              buddy={buddy}
              missions={missions}
              onSearch={() => {}}
            />
          </LearnShellContent>
        </LearnShell>
      </DayStepOpenerProvider>
    </LearnProvider>
  );
}
