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
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronDownIcon, LayoutGridIcon, LightbulbIcon, PlusIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useOptimistic, useSyncExternalStore, useTransition } from "react";
import { daysUntilIsoDate, hasIsoDatePassed } from "../_utils/iso-date";
import { useFormatDuration } from "../_utils/time-format";
import { LearnLink } from "../learn-link";
import { GoalMark } from "./goal-mark";

type GoalKind = "exam" | "explain" | "language" | "learn";

type SwitcherGoal = {
  dailyMinutes: number;
  id: string;
  kind: GoalKind;
  status: "active" | "completed" | "paused";
  targetDate: string | null;
  targetLanguage: string | null;
  title: string;
};

const goalSwitches = { listeners: new Set<() => void>(), pending: 0 };

function subscribeToGoalSwitches(listener: () => void): () => void {
  goalSwitches.listeners.add(listener);
  return () => goalSwitches.listeners.delete(listener);
}

function addGoalSwitch(change: 1 | -1) {
  goalSwitches.pending += change;

  for (const listener of goalSwitches.listeners) {
    listener();
  }
}

export function useGoalSwitchTransition() {
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isPending) {
      return;
    }

    addGoalSwitch(1);
    return () => addGoalSwitch(-1);
  }, [isPending]);

  return [isPending, startTransition] as const;
}

/** While a switch is on its way the page still shows the previous goal, so it dims: a tap on its Continue would open that goal's session. */
export function useGoalSwitchPending(): boolean {
  return useSyncExternalStore(
    subscribeToGoalSwitches,
    () => goalSwitches.pending > 0,
    () => false,
  );
}

function GoalLine({ goal }: { goal: SwitcherGoal }) {
  const t = useExtracted("goalSwitcher");
  const today = useMountTime();
  const formatDuration = useFormatDuration();

  const days =
    goal.targetDate && !hasIsoDatePassed({ isoDate: goal.targetDate, today })
      ? daysUntilIsoDate({ isoDate: goal.targetDate, today })
      : null;

  const active = [
    t("{time} a day", { time: formatDuration(goal.dailyMinutes) }),
    days !== null &&
      t("{days, plural, =0 {The day is here} one {# day left} other {# days left}}", { days }),
  ]
    .filter(Boolean)
    .join(" · ");

  const line = { active, completed: t("Finished"), paused: t("Paused") }[goal.status];

  return (
    <span className="text-muted-foreground font-mono text-[0.71875rem] tabular-nums">{line}</span>
  );
}

const MENU_ROW_CLASS = "rounded-lg pl-2 text-[0.84375rem] pointer-fine:min-h-9";

const MENU_LABEL_CLASS = "text-faint px-2 pt-1.5 pb-1 text-[0.71875rem] font-[550]";

function GoalOption({ goal }: { goal: SwitcherGoal }) {
  return (
    <DropdownMenuRadioItem
      className={cn(MENU_ROW_CLASS, "gap-2.5 py-1.5")}
      closeOnClick
      value={goal.id}
    >
      <GoalMark goal={goal} />
      <span className="flex min-w-0 flex-col">
        <span>{goal.title}</span>
        <GoalLine goal={goal} />
      </span>
    </DropdownMenuRadioItem>
  );
}

function ExplanationOption({ goal, href }: { goal: SwitcherGoal; href: string }) {
  return (
    <DropdownMenuItem
      className={cn(MENU_ROW_CLASS, "items-start py-2 pr-2")}
      render={<LearnLink href={href} />}
    >
      <LineMarker aria-hidden="true">
        <LightbulbIcon className="text-muted-foreground size-4 shrink-0" />
      </LineMarker>
      <span className="min-w-0">{goal.title}</span>
    </DropdownMenuItem>
  );
}

/** The bar's trigger hangs 8px into the gutter (`-ml-2`), so it may be that much wider than its slot. */
const TRIGGER_CLASS = {
  bar: "hover:bg-muted aria-expanded:bg-muted focus-visible:ring-ring/50 hit-area relative -ml-2 flex h-9 max-w-[calc(100%+0.5rem)] min-w-0 items-center gap-2 rounded-lg px-2 text-[0.9375rem] font-semibold outline-none focus-visible:ring-[3px]",
  sidebar:
    "hover:bg-sidebar-accent/70 aria-expanded:bg-sidebar-accent focus-visible:ring-ring/50 hit-area relative flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-1.5 text-[0.84375rem] font-semibold outline-none focus-visible:ring-[3px]",
} as const;

type SwitcherPlacement = keyof typeof TRIGGER_CLASS;

function NoGoalLink({
  newGoalHref,
  placement,
}: {
  newGoalHref: string;
  placement: SwitcherPlacement;
}) {
  const t = useExtracted("goalSwitcher");

  return (
    <LearnLink className={TRIGGER_CLASS[placement]} href={newGoalHref}>
      <PlusIcon aria-hidden="true" className="size-4 shrink-0" />
      <span className="truncate">{t("Start a goal")}</span>
    </LearnLink>
  );
}

export function GoalSwitcher({
  activeGoalId,
  explanationHref,
  exploreHref,
  goals,
  newGoalHref,
  onSelect,
  placement = "bar",
}: {
  activeGoalId: string | null;
  explanationHref: string;
  exploreHref: string;
  goals: SwitcherGoal[];
  newGoalHref: string;
  onSelect: (goalId: string) => Promise<void>;
  placement?: SwitcherPlacement;
}) {
  const t = useExtracted("goalSwitcher");
  const [isPending, startTransition] = useGoalSwitchTransition();
  const followed = goals.filter((goal) => goal.kind !== "explain");
  const explanations = goals.filter((goal) => goal.kind === "explain");
  const [selectedId, setSelectedId] = useOptimistic(activeGoalId ?? followed[0]?.id ?? null);
  const selected = followed.find((goal) => goal.id === selectedId) ?? followed[0];

  if (!selected && explanations.length === 0) {
    return <NoGoalLink newGoalHref={newGoalHref} placement={placement} />;
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
        className={TRIGGER_CLASS[placement]}
        title={selected?.title}
      >
        {selected ? (
          <GoalMark goal={selected} />
        ) : (
          <PlusIcon aria-hidden="true" className="size-4 shrink-0" />
        )}
        <span className="min-w-0 flex-1 truncate text-left">
          {selected?.title ?? t("Start a goal")}
        </span>
        {/* After the title, so the trigger's name starts with the words on screen. */}
        {selected && <span className="sr-only">{t(", current goal. Switch goal")}</span>}
        <ChevronDownIcon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-72 max-w-[calc(100vw-2rem)] p-1.5"
        collisionPadding={16}
        sideOffset={6}
      >
        {selected && (
          <DropdownMenuGroup>
            <DropdownMenuLabel className={MENU_LABEL_CLASS}>{t("Your goals")}</DropdownMenuLabel>

            <DropdownMenuRadioGroup onValueChange={select} value={selected.id}>
              {followed.map((goal) => (
                <GoalOption goal={goal} key={goal.id} />
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        )}

        {explanations.length > 0 && (
          <DropdownMenuGroup>
            {selected && <DropdownMenuSeparator className="-mx-1.5" />}
            <DropdownMenuLabel className={MENU_LABEL_CLASS}>
              {t("Quick explanations")}
            </DropdownMenuLabel>

            {explanations.map((goal) => (
              <ExplanationOption goal={goal} href={`${explanationHref}/${goal.id}`} key={goal.id} />
            ))}
          </DropdownMenuGroup>
        )}

        <DropdownMenuSeparator className="-mx-1.5" />

        <DropdownMenuItem
          className={cn(MENU_ROW_CLASS, "pr-2")}
          render={<LearnLink href={newGoalHref} />}
        >
          <PlusIcon aria-hidden="true" className="text-muted-foreground" />
          {t("Start a new goal")}
        </DropdownMenuItem>

        <DropdownMenuItem
          className={cn(MENU_ROW_CLASS, "pr-2")}
          render={<LearnLink href={exploreHref} />}
        >
          <LayoutGridIcon aria-hidden="true" className="text-muted-foreground" />
          {t("Explore courses")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
