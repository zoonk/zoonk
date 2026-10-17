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
 * is always amber with the same arrow, a mock exam always orange with a stopwatch. A lesson, most
 * of every day, is the neutral default, so color marks the kinds that differ from it. A kind shows
 * as an 8px dot in its color (`KindDot`) beside a row's words, or its icon in its color
 * (`KindIcon`) where a shape helps, so a mixed list can be scanned without reading. A list of one
 * kind (the exam's mocks, the notebook's skills) marks each row's state instead.
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

type KindMarks = {
  /** The dot: the color alone, 3:1 or more on the page and on a row's highlight in both themes. */
  dot: string;
  icon: LucideIcon;
  /** The color as text or an icon's stroke, AA on the page in both themes. */
  text: string;
};

/**
 * Every kind's marks in one place, the only map from a kind to a color or an icon: a screen marks a
 * kind through `KindDot`, `KindIcon` or `kindTextClass`, never with its own classes, so a kind
 * can't look different from one screen to the next. A kind added without its marks fails the type
 * check. A hue never already means something else (`references/color.md`): green is progress
 * made, blue the learner's own pick and place, violet Brain Power. Review and practice share amber,
 * going back over what was learned; amber's other meanings (a flag, Energy) are never dots.
 */
const KIND_MARKS = {
  // Lime, not violet: violet is Brain Power's alone. The light dot is lime-700, since lime-600 is
  // under 3:1 on the page.
  challenge: {
    dot: "bg-lime-700 dark:bg-lime-400",
    icon: SwordsIcon,
    text: "text-lime-700 dark:text-lime-300",
  },
  conversation: {
    dot: "bg-teal-600 dark:bg-teal-300",
    icon: MessagesSquareIcon,
    text: "text-teal-700 dark:text-teal-300",
  },
  // The conversation's teal: speaking and writing are both making something yourself. A cyan read
  // as a second blue beside the learner's own.
  essay: {
    dot: "bg-teal-600 dark:bg-teal-300",
    icon: PenLineIcon,
    text: "text-teal-700 dark:text-teal-300",
  },
  // Neutral: the default kind, and no blue to mistake for the learner's own (`selected`).
  lesson: { dot: "bg-faint", icon: BookOpenIcon, text: "text-muted-foreground" },
  mindMap: {
    dot: "bg-fuchsia-500 dark:bg-fuchsia-400",
    icon: NetworkIcon,
    text: "text-fuchsia-700 dark:text-fuchsia-300",
  },
  mistakes: {
    dot: "bg-rose-500 dark:bg-rose-400",
    icon: NotebookPenIcon,
    text: "text-rose-700 dark:text-rose-300",
  },
  mock: {
    dot: "bg-orange-600 dark:bg-orange-400",
    icon: TimerIcon,
    text: "text-orange-700 dark:text-orange-300",
  },
  // Review's amber, not green: a green dot beside the done checks read as done.
  practice: {
    dot: "bg-amber-700 dark:bg-amber-400",
    icon: DumbbellIcon,
    text: "text-amber-700 dark:text-amber-300",
  },
  review: {
    dot: "bg-amber-700 dark:bg-amber-400",
    icon: RotateCcwIcon,
    text: "text-amber-700 dark:text-amber-300",
  },
} as const satisfies Readonly<Record<LearnKind, KindMarks>>;

/** A kind's color as text, for something drawn in it (a mock's line on the progress chart). */
export function kindTextClass(kind: LearnKind): string {
  return KIND_MARKS[kind].text;
}

/**
 * A kind as an 8px dot in its color, the mark of a row in a queue (the day's session): the color
 * says what it is without competing with the row's words. Decorative: the text beside it names
 * the thing.
 */
export function KindDot({ className, kind }: { className?: string; kind: LearnKind }) {
  return (
    <span
      aria-hidden="true"
      className={cn("size-2 shrink-0 rounded-full", KIND_MARKS[kind].dot, className)}
      data-slot="kind-dot"
    />
  );
}

/**
 * A kind's icon in its color without a tile, for a row that needs its shape too: the shape and
 * color still say what it is. Decorative: the text beside it names the thing.
 */
export function KindIcon({ className, kind }: { className?: string; kind: LearnKind }) {
  const Icon = KIND_MARKS[kind].icon;

  return (
    <Icon
      aria-hidden="true"
      className={cn("size-4 shrink-0", KIND_MARKS[kind].text, className)}
      data-slot="kind-icon"
      strokeWidth={2}
    />
  );
}

/**
 * A kind's mark in a list where kinds sit side by side (the day's queue, the missions, the plan's
 * events): its icon at 14px in its color, as tall as the done mark that takes its place. The shape
 * tells kinds apart where hue alone wouldn't (review's amber beside the mock's orange for a
 * red-green colorblind learner; review and practice share a hue). Decorative: the row's words name
 * the thing.
 */
export function KindMark({ className, kind }: { className?: string; kind: LearnKind }) {
  return <KindIcon className={cn("size-3.5", className)} kind={kind} />;
}
