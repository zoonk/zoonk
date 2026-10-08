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
import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { cn } from "@zoonk/ui/lib/utils";
import {
  BookOpenIcon,
  ChevronDownIcon,
  GraduationCapIcon,
  LanguagesIcon,
  LayoutGridIcon,
  LightbulbIcon,
  PlusIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { useOptimistic, useTransition } from "react";
import { type LearnKind, kindToneClass } from "../_components/kind-tile";
import { daysUntilIsoDate } from "../_utils/iso-date";
import { LearnLink } from "../learn-link";

type GoalKind = "exam" | "explain" | "language" | "learn";

/** What the switcher shows about each goal. Archived goals aren't listed. */
type SwitcherGoal = {
  dailyMinutes: number;
  id: string;
  kind: GoalKind;
  status: "active" | "completed" | "paused";
  /** The goal's date (YYYY-MM-DD), for the days left; null without one. */
  targetDate: string | null;
  /** The language a language goal learns, which shows its flag; null for other goals. */
  targetLanguage: string | null;
  title: string;
};

/**
 * "45 min a day · 32 days left" for a goal being followed (the days only when it has a date); a
 * paused or finished one says so instead.
 */
function GoalLine({ goal }: { goal: SwitcherGoal }) {
  const t = useExtracted();
  const today = useMountTime();
  const days = goal.targetDate ? daysUntilIsoDate({ isoDate: goal.targetDate, today }) : null;

  const active = [
    t("{minutes} min a day", { minutes: String(goal.dailyMinutes) }),
    days !== null &&
      t("{days, plural, =0 {The day is here} one {# day left} other {# days left}}", { days }),
  ]
    .filter(Boolean)
    .join(" · ");

  const line = { active, completed: t("Finished"), paused: t("Paused") }[goal.status];

  return <span className="text-muted-foreground text-xs tabular-nums">{line}</span>;
}

/** Each kind of goal in its color, as the app's kinds have one: learning in sky, languages in teal. */
const GOAL_TONES: Record<GoalKind, LearnKind> = {
  exam: "lesson",
  explain: "review",
  language: "conversation",
  learn: "lesson",
};

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
 * One goal in the menu, its icon on a tile in its kind's color, with its time a day and days left
 * (or that it's paused) under the title. The menu is where a cut trigger title reads in full, so
 * titles wrap.
 */
function GoalOption({ goal }: { goal: SwitcherGoal }) {
  const tone = GOAL_TONES[goal.kind];

  return (
    <DropdownMenuRadioItem className="items-center gap-3 py-2" closeOnClick value={goal.id}>
      {/* Each goal on a small tile, as rows do across the app; flags take the icons' width. */}
      <span
        aria-hidden="true"
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          kindToneClass(tone),
        )}
      >
        <GoalIcon className="w-4" goal={goal} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span>{goal.title}</span>
        <GoalLine goal={goal} />
      </span>
    </DropdownMenuRadioItem>
  );
}

/**
 * A quick explanation the learner hasn't finished: it has no day or Journey for the tabs to show,
 * so it opens the explanation itself. A finished one leaves the menu.
 */
function ExplanationOption({ goal, href }: { goal: SwitcherGoal; href: string }) {
  return (
    <DropdownMenuItem className="items-start py-2.5" render={<LearnLink href={href} />}>
      <LineMarker aria-hidden="true">
        <LightbulbIcon className="text-muted-foreground size-4 shrink-0" />
      </LineMarker>
      <span className="min-w-0">{goal.title}</span>
    </DropdownMenuItem>
  );
}

const TRIGGER_CLASS =
  "border-border bg-background hover:bg-muted focus-visible:ring-ring/50 hit-area relative flex h-11 max-w-full min-w-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium outline-none focus-visible:ring-[3px] lg:h-10";

/**
 * Learners without a goal yet (a guest, or someone who archived them all) get one way to start
 * one.
 */
function NoGoalLink({ newGoalHref }: { newGoalHref: string }) {
  const t = useExtracted();

  return (
    <LearnLink className={TRIGGER_CLASS} href={newGoalHref}>
      <PlusIcon aria-hidden="true" />
      <span className="truncate">{t("Start a goal")}</span>
    </LearnLink>
  );
}

/**
 * The goal the tabs show, on the left of the top bar. Every tab reads the same goal, so switching
 * here changes Today, the Journey and the buddy at once. The choice shows immediately and
 * the host saves it (`onSelect`), then the tabs re-render with the new goal. The menu only
 * switches: it lists each goal with its time a day and leads to a new goal or the course catalog.
 * Quick explanations not read to the end follow the goals, each opening itself
 * (`explanationHref/{id}`). What acts on one goal (pausing, archiving) lives on that goal's own
 * page, the Journey.
 */
export function GoalSwitcher({
  activeGoalId,
  explanationHref,
  exploreHref,
  goals,
  newGoalHref,
  onSelect,
}: {
  activeGoalId: string | null;
  explanationHref: string;
  exploreHref: string;
  goals: SwitcherGoal[];
  newGoalHref: string;
  onSelect: (goalId: string) => Promise<void>;
}) {
  const t = useExtracted();
  const [isPending, startTransition] = useTransition();
  const followed = goals.filter((goal) => goal.kind !== "explain");
  const explanations = goals.filter((goal) => goal.kind === "explain");
  const [selectedId, setSelectedId] = useOptimistic(activeGoalId ?? followed[0]?.id ?? null);
  const selected = followed.find((goal) => goal.id === selectedId) ?? followed[0];

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
          <DropdownMenuLabel>{t("Your goals")}</DropdownMenuLabel>

          <DropdownMenuRadioGroup onValueChange={select} value={selected.id}>
            {followed.map((goal) => (
              <GoalOption goal={goal} key={goal.id} />
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>

        {explanations.length > 0 && (
          <DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t("Quick explanations")}</DropdownMenuLabel>

            {explanations.map((goal) => (
              <ExplanationOption goal={goal} href={`${explanationHref}/${goal.id}`} key={goal.id} />
            ))}
          </DropdownMenuGroup>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem render={<LearnLink href={newGoalHref} />}>
          <PlusIcon aria-hidden="true" />
          {t("Start a new goal")}
        </DropdownMenuItem>

        <DropdownMenuItem render={<LearnLink href={exploreHref} />}>
          <LayoutGridIcon aria-hidden="true" />
          {t("Explore courses")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
