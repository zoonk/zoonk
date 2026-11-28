import { useBeltLabel } from "@repo/apps/main/src/lib/belt-label.ts";
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
import { LearnLevelLink } from "@repo/packages/learn/src/shell/level-link.tsx";
import { LearnTabRootBar } from "@repo/packages/learn/src/shell/tab-root-bar.tsx";
import { Avatar, AvatarFallback } from "@repo/packages/ui/src/components/avatar.tsx";
import { type BeltColor } from "@repo/packages/utils/src/belt-level.ts";
import { User } from "lucide-react";
import { type ComponentProps, type ReactNode } from "react";
import { story } from "../story";

export function Link({
  href,
  children,
  onClick,
  onNavigate: _onNavigate,
  prefetch: _prefetch,
  scroll: _scroll,
  lessonWritten: _lessonWritten,
  ref,
  title,
  ...rest
}: LearnLinkComponentProps & { title?: string }) {
  return (
    <a
      {...rest}
      href={href}
      ref={ref}
      title={title}
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
    mockChooser: "/mock/new",
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

type SwitcherGoal = ComponentProps<typeof GoalSwitcher>["goals"][number];
type ShellGoal = Omit<
  SwitcherGoal,
  "status" | "languageFlag" | "targetDateEstimated" | "targetLanguage" | "targetRegion"
> &
  Partial<Pick<SwitcherGoal, "languageFlag" | "targetLanguage" | "targetRegion">>;

export function StudioTabBar({
  color,
  level,
  switcher,
}: {
  color: BeltColor;
  level: number;
  switcher: ReactNode;
}) {
  const belt = useBeltLabel(color);

  return (
    <LearnTabRootBar
      end={
        <>
          <LearnLevelLink belt={belt} href="/level" level={{ color, level }} link={Link} />
          <span className="relative size-7 shrink-0 rounded-full">
            <Avatar className="size-full">
              <AvatarFallback>
                <User size={16} />
              </AvatarFallback>
            </Avatar>
          </span>
        </>
      }
      start={switcher}
    />
  );
}

function TopBar({ goal }: { goal: ShellGoal }) {
  return (
    <StudioTabBar
      color="white"
      level={1}
      switcher={
        <GoalSwitcher
          activeGoalId={goal.id}
          explanationHref="/explain"
          exploreHref="/courses"
          goals={[
            {
              ...goal,
              languageFlag: goal.languageFlag ?? null,
              status: "active",
              targetDateEstimated: false,
              targetLanguage: goal.targetLanguage ?? null,
              targetRegion: goal.targetRegion ?? null,
            },
          ]}
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
