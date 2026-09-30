"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { LanguageFlag, hasLanguageFlag } from "@zoonk/ui/components/language-flag";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import {
  BookOpenIcon,
  ChevronDownIcon,
  CompassIcon,
  GraduationCapIcon,
  LanguagesIcon,
  LightbulbIcon,
  PlusIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { useOptimistic, useTransition } from "react";
import { LearnLink } from "../learn-link";

type GoalKind = "exam" | "explain" | "language" | "learn";

/**
 * What the switcher shows about each goal. `dailyMinutes` is its share of the day, null for a
 * paused or finished goal, which takes no time.
 */
type SwitcherGoal = {
  dailyMinutes: number | null;
  id: string;
  kind: GoalKind;
  /** The language a language goal learns, which shows its flag; null for other goals. */
  targetLanguage: string | null;
  title: string;
};

/** A goal's minutes in the day, on the first line of its title. */
function GoalMinutes({ minutes }: { minutes: number | null }) {
  const t = useExtracted();

  if (minutes === null) {
    return null;
  }

  return (
    <LineMarker className="ml-auto">
      <span className="text-muted-foreground text-xs tabular-nums">
        {t("{minutes} min", { minutes: String(minutes) })}
      </span>
    </LineMarker>
  );
}

const GOAL_ICONS: Record<GoalKind, typeof BookOpenIcon> = {
  exam: GraduationCapIcon,
  explain: LightbulbIcon,
  language: LanguagesIcon,
  learn: BookOpenIcon,
};

/** A language goal shows the flag of the variety it learns; the rest their kind's icon. */
function GoalIcon({ className, goal }: { className?: string; goal: SwitcherGoal }) {
  if (goal.kind === "language" && hasLanguageFlag(goal.targetLanguage)) {
    return <LanguageFlag className={cn("w-5", className)} language={goal.targetLanguage} />;
  }

  const Icon = GOAL_ICONS[goal.kind];
  return <Icon aria-hidden="true" className={cn("size-4 shrink-0", className)} />;
}

/**
 * One goal in the menu. The menu is where a cut trigger title reads in full, so titles wrap and the
 * icon, minutes and check stay on their first line.
 */
function GoalOption({ goal }: { goal: SwitcherGoal }) {
  return (
    <DropdownMenuRadioItem className="items-start py-3" closeOnClick value={goal.id}>
      {/* Flags take the icons' width here, so every title starts at the same edge. */}
      <LineMarker aria-hidden="true">
        <GoalIcon className="text-muted-foreground w-4" goal={goal} />
      </LineMarker>
      <span className="min-w-0">{goal.title}</span>
      <GoalMinutes minutes={goal.dailyMinutes} />
    </DropdownMenuRadioItem>
  );
}

const TRIGGER_CLASS =
  "border-border bg-background hover:bg-muted focus-visible:ring-ring/50 in-data-[mode=fun]:fun-glass in-data-[mode=fun]:text-fun-fg hit-area relative flex h-11 max-w-full min-w-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium outline-none focus-visible:ring-[3px] lg:h-10";

/** Learners without a goal yet (a guest, or someone who archived them all) get one way to set one. */
function NoGoalLink({ newGoalHref }: { newGoalHref: string }) {
  const t = useExtracted();

  return (
    <LearnLink className={TRIGGER_CLASS} href={newGoalHref}>
      <PlusIcon aria-hidden="true" className="size-4 shrink-0" />
      <span className="truncate">{t("Set a goal")}</span>
    </LearnLink>
  );
}

/**
 * The goal the tabs show, on the left of the top bar. Every tab reads the same goal, so switching
 * here changes Today, the plan, progress and content at once. The choice shows immediately and
 * the host saves it (`onSelect`), then the tabs re-render with the new goal. The menu lists each
 * goal's minutes and the day's total, and leads to a new goal or the course catalog.
 */
export function GoalSwitcher({
  activeGoalId,
  dailyMinutes,
  exploreHref,
  goals,
  newGoalHref,
  onSelect,
}: {
  activeGoalId: string | null;
  /** The day's total across active goals ("Today: 55 min"). */
  dailyMinutes: number;
  exploreHref: string;
  goals: SwitcherGoal[];
  newGoalHref: string;
  onSelect: (goalId: string) => Promise<void>;
}) {
  const t = useExtracted();
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useOptimistic(activeGoalId ?? goals[0]?.id ?? null);
  const selected = goals.find((goal) => goal.id === selectedId) ?? goals[0];

  if (!selected) {
    return <NoGoalLink newGoalHref={newGoalHref} />;
  }

  const select = (goalId: string) => {
    if (goalId === selectedId) {
      return;
    }

    startTransition(async () => {
      setSelectedId(goalId);
      await onSelect(goalId);
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-busy={isPending}
        aria-label={t("Current goal: {goal}. Switch goal", { goal: selected.title })}
        className={TRIGGER_CLASS}
        // A long title is cut on phones: hovering shows it whole, and tapping opens the full list.
        title={selected.title}
      >
        <GoalIcon goal={selected} />
        <span className="truncate">{selected.title}</span>
        <ChevronDownIcon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-72 max-w-[calc(100vw-2rem)]">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            {t("Today: {minutes} min", { minutes: String(dailyMinutes) })}
          </DropdownMenuLabel>

          <DropdownMenuRadioGroup onValueChange={select} value={selected.id}>
            {goals.map((goal) => (
              <GoalOption goal={goal} key={goal.id} />
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem render={<LearnLink href={newGoalHref} />}>
          <PlusIcon aria-hidden="true" />
          {t("Add a goal")}
        </DropdownMenuItem>

        <DropdownMenuItem render={<LearnLink href={exploreHref} />}>
          <CompassIcon aria-hidden="true" />
          {t("Explore courses")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
