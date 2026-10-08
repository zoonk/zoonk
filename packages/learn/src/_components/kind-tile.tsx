import { cn } from "@zoonk/ui/lib/utils";
import {
  BookOpenIcon,
  DumbbellIcon,
  type LucideIcon,
  MessagesSquareIcon,
  NetworkIcon,
  NotebookPenIcon,
  PenLineIcon,
  RotateCcwIcon,
  SwordsIcon,
  TimerIcon,
} from "lucide-react";

/**
 * The kinds of things a learner meets, each with one color and one icon used everywhere: a review
 * is always amber with the same arrow, a mock exam always orange with a stopwatch. Color marks
 * what a thing is, so a screen can be scanned without reading.
 */
export type LearnKind =
  | "challenge"
  | "conversation"
  | "essay"
  | "lesson"
  | "mindMap"
  | "mistakes"
  | "mock"
  | "practice"
  | "review";

const KIND_TONE: Readonly<Record<LearnKind, string>> = {
  challenge: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  conversation: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  essay: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  lesson: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  mindMap: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300",
  mistakes: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  mock: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  practice: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  review: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

const KIND_ICON: Readonly<Record<LearnKind, LucideIcon>> = {
  challenge: SwordsIcon,
  conversation: MessagesSquareIcon,
  essay: PenLineIcon,
  lesson: BookOpenIcon,
  mindMap: NetworkIcon,
  mistakes: NotebookPenIcon,
  mock: TimerIcon,
  practice: DumbbellIcon,
  review: RotateCcwIcon,
};

const SIZE_CLASS = {
  lg: "size-16 rounded-2xl [&>svg]:size-8",
  md: "size-11 rounded-xl [&>svg]:size-5",
  sm: "size-8 rounded-lg [&>svg]:size-4",
} as const;

/** A kind's tile colors (background and icon), for a tile that holds something else (a flag). */
export function kindToneClass(kind: LearnKind): string {
  return KIND_TONE[kind];
}

/** The text color of a kind, for a dot, a ring or an accent beside its tile. */
export function kindTextClass(kind: LearnKind): string {
  return KIND_TONE[kind]
    .split(" ")
    .filter((token) => token.includes("text-"))
    .join(" ");
}

/**
 * A kind's icon on its tinted tile: the visual anchor of a row, a card or an intro. Decorative:
 * the text beside it names the thing.
 */
export function KindTile({
  className,
  icon,
  kind,
  size = "md",
}: {
  className?: string;
  /** Overrides the kind's usual icon (e.g. a subject's own icon) while keeping its color. */
  icon?: LucideIcon;
  kind: LearnKind;
  size?: keyof typeof SIZE_CLASS;
}) {
  const Icon = icon ?? KIND_ICON[kind];

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        KIND_TONE[kind],
        SIZE_CLASS[size],
        className,
      )}
      data-slot="kind-tile"
    >
      <Icon strokeWidth={2} />
    </span>
  );
}
