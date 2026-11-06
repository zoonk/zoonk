import {
  type LearnAdapters,
  type LearnLinkComponentProps,
} from "@repo/packages/learn/src/learn-context.tsx";
// Shared frame for the learn views: no-op learn adapters and the phone layout Main composes around each route.
import { LearnProvider } from "@repo/packages/learn/src/learn-provider.tsx";
import { OnboardingPage } from "@repo/packages/learn/src/onboarding/onboarding-host.tsx";
import {
  LearnShell,
  LearnShellContent,
  LearnShellMain,
} from "@repo/packages/learn/src/shell/learn-shell.tsx";
import { type ReactNode } from "react";
import { story } from "../story";

export function Link({
  href,
  children,
  onClick,
  prefetch,
  scroll,
  lessonWritten,
  unstable_dynamicOnHover,
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

export const ADAPTERS: LearnAdapters = {
  analytics: { track: (() => {}) as any },
  linkComponent: Link,
  routes: {
    buddy: "/buddy",
    journey: "/plan",
    signUp: "/login",
    today: "/today",
    upgrade: "/subscription",
  },
};

export const noop = () => {};
export const noopAsync = async () => ({}) as any;

export type ViewProps = { lang: "en" | "pt"; state: string; q: URLSearchParams };

export function S(lang: "en" | "pt") {
  return story[lang];
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
      <LearnShell className="overflow-x-clip">
        <LearnShellContent>
          <LearnShellMain>
            <OnboardingPage backHref={backHref}>{children}</OnboardingPage>
          </LearnShellMain>
        </LearnShellContent>
      </LearnShell>
    </LearnProvider>
  );
}

import { type LearnBuddy } from "@repo/packages/learn/src/buddies/use-buddy-name.ts";
// ---- Tab pages (Today, Plan, buddy): Main's phone frame = top bar (goal switcher, belt level,
// avatar, search) + page + bottom tabs. Mirrors apps/main learn-frame.tsx / learn-bar-end.tsx.
import { GoalSwitcher } from "@repo/packages/learn/src/shell/goal-switcher.tsx";
import {
  LearnBottomNavigation,
  type LearnTab,
} from "@repo/packages/learn/src/shell/learn-navigation.tsx";
import {
  LearnShellEnd,
  LearnShellHeader,
  LearnShellStart,
} from "@repo/packages/learn/src/shell/learn-shell.tsx";
import { Avatar, AvatarFallback } from "@repo/packages/ui/src/components/avatar.tsx";
import { BeltIndicator } from "@repo/packages/ui/src/components/belt-indicator.tsx";
import { SidebarSearch } from "@repo/packages/ui/src/components/sidebar-toggle.tsx";
import { User } from "lucide-react";
import { useExtracted } from "next-intl";

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
  kind: "career" | "learn" | "exam" | "language" | "explain" | "music" | "custom" | string;
  dailyMinutes: number;
  targetDate: string | null;
};

function TopBar({ goal }: { goal: ShellGoal }) {
  const t = useExtracted();
  const belt = t(
    "{color, select, white {White belt} yellow {Yellow belt} orange {Orange belt} green {Green belt} blue {Blue belt} purple {Purple belt} brown {Brown belt} red {Red belt} gray {Gray belt} black {Black belt} other {Belt}}",
    { color: "white" },
  );

  return (
    <LearnShellHeader className="lg:hidden">
      <LearnShellStart>
        <GoalSwitcher
          activeGoalId={goal.id}
          explanationHref="/explain"
          exploreHref="/courses"
          goals={[
            {
              dailyMinutes: goal.dailyMinutes,
              id: goal.id,
              kind: goal.kind as any,
              status: "active",
              targetDate: goal.targetDate,
              targetLanguage: null,
              title: goal.title,
            },
          ]}
          newGoalHref="/start"
          onSelect={async () => {}}
          onStartWaiting={async () => {}}
          waitingGoals={[]}
        />
      </LearnShellStart>
      <LearnShellEnd>
        <a
          className="text-muted-foreground hit-area relative flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 font-mono text-[0.8125rem] tabular-nums"
          href="/stats"
        >
          <BeltIndicator aria-hidden="true" className="size-2.5" color="white" label={belt} />
          <span aria-hidden="true">3</span>
        </a>
        <span className="hit-area relative size-7 shrink-0 rounded-full">
          <Avatar className="size-full">
            <AvatarFallback>
              <User size={16} />
            </AvatarFallback>
          </Avatar>
        </span>
      </LearnShellEnd>
      <SidebarSearch
        className="col-span-2 mt-1.5"
        label={t("Search or ask…")}
        onClick={() => {}}
        placement="bar"
      />
    </LearnShellHeader>
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
      <LearnShell className="overflow-x-clip">
        <LearnShellContent>
          <TopBar goal={goal} />
          <LearnShellMain>{children}</LearnShellMain>
          <LearnBottomNavigation activeTab={tab} buddy={buddy} missions={missions} />
        </LearnShellContent>
      </LearnShell>
    </LearnProvider>
  );
}
