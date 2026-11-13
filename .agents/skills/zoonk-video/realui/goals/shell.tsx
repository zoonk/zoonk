import { GenerationFollowerProvider } from "@repo/packages/learn/src/generation/generation-follower.tsx";
// Shared phone frame for the goal screens: the learn adapters, the tab root's top bar and the bottom tabs.
import { LearnProvider } from "@repo/packages/learn/src/learn-provider.tsx";
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
} from "@repo/packages/learn/src/shell/learn-shell.tsx";
import { Avatar, AvatarFallback } from "@repo/packages/ui/src/components/avatar.tsx";
import { BeltIndicator } from "@repo/packages/ui/src/components/belt-indicator.tsx";
import { Button } from "@repo/packages/ui/src/components/button.tsx";
import { PageTopBar } from "@repo/packages/ui/src/components/page-top.tsx";
import { SearchIcon, User } from "lucide-react";
import { useExtracted } from "next-intl";
import { ADAPTERS } from "../learn/common";
import { story, type Lang } from "../story";

export const NOOP = () => {};
export const NOOP_ASYNC = async () => null as any;

function Follower({ children }: any) {
  return children?.({ status: "running" }) ?? null;
}

export function Learn({ children }: { children: React.ReactNode }) {
  return (
    <LearnProvider adapters={ADAPTERS}>
      <GenerationFollowerProvider follower={Follower as any}>{children}</GenerationFollowerProvider>
    </LearnProvider>
  );
}

export type GoalKey = "exam" | "language" | "career" | "learn";

export function switcherGoals(lang: Lang) {
  const s = story[lang] as any;
  return [
    {
      dailyMinutes: s.exam.minutesPerDay,
      id: "exam",
      kind: "exam",
      status: "active",
      targetDate: s.exam.date,
      targetLanguage: null,
      title: s.exam.title,
    },
    {
      dailyMinutes: 20,
      id: "language",
      kind: "language",
      status: "active",
      targetDate: null,
      targetLanguage: s.language.target,
      title: s.language.title,
    },
    {
      dailyMinutes: s.career.minutesPerDay,
      id: "career",
      kind: "learn",
      status: "active",
      targetDate: s.career.date,
      targetLanguage: null,
      title: s.career.title,
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

function BarLevel({ color, level }: { color: any; level: number }) {
  return (
    <span className="text-muted-foreground relative flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 font-mono text-[0.8125rem] tabular-nums">
      <BeltIndicator aria-hidden="true" className="size-2.5" color={color} label="" />
      <span aria-hidden="true">{level}</span>
    </span>
  );
}

/** Under `lg` the bar's icon opens the command palette. */
function Search() {
  const t = useExtracted();
  return (
    <Button className="text-muted-foreground" onClick={NOOP} size="icon-bar" variant="ghost">
      <SearchIcon aria-hidden="true" />
      <span className="sr-only">{t("Search")}</span>
    </Button>
  );
}

/** The tab root's top bar on phones: goal switcher, then search, belt and level, avatar. */
export function TopBar({ goal, lang }: { goal: GoalKey; lang: Lang }) {
  const initial = (story[lang] as any).learnerName?.[0];
  return (
    <div className={FRAME_COLUMN_CLASS}>
      <PageTopBar
        actions={
          <>
            <Search />
            <BarLevel color="yellow" level={4} />
            <span className="relative size-7 shrink-0 rounded-full">
              <Avatar className="size-full">
                <AvatarFallback>{initial || <User size={16} />}</AvatarFallback>
              </Avatar>
            </span>
          </>
        }
        back={
          <GoalSwitcher
            activeGoalId={goal}
            explanationHref="/explain"
            exploreHref="/courses"
            goals={switcherGoals(lang) as any}
            newGoalHref="/start"
            onSelect={NOOP_ASYNC}
            onStartWaiting={NOOP_ASYNC}
            placement="bar"
            waitingGoals={[]}
          />
        }
      />
    </div>
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
  buddy?: any;
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
          <LearnBottomNavigation activeTab={tab} buddy={buddy} missions={missions} />
        </LearnShellContent>
      </LearnShell>
    </Learn>
  );
}
