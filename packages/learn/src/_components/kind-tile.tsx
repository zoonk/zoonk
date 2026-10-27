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
  /** The color as a fill: the kind's dot, its part of a meter. */
  fill: string;
  icon: LucideIcon;
  /** The color as text or an icon's stroke. */
  text: string;
};

/**
 * Every kind's marks in one place, the only map from a kind to a color or an icon: a screen marks a
 * kind through `KindDot`, `KindIcon`, `kindFillClass` or `kindTextClass`, never with its own
 * classes, so a kind can't look different from one screen to the next. A kind added without its
 * marks fails the type check. The hues are `@zoonk/ui`'s `kind-*` tokens (soft, deeper with more
 * contrast), and none already means something else: blue is progress made, violet Brain Power,
 * pink-red wrong. Kinds that do the same job share a hue and differ by their icon: review,
 * practice and mistakes go back over what was learned (amber; amber's other meanings, a flag and
 * Energy, are never dots), a mock and a challenge test what the learner knows (orange).
 */
const KIND_MARKS = {
  // The mock's orange: both test what the learner knows. Lime read as green, and violet is Brain
  // Power's alone.
  challenge: { fill: "bg-kind-mock", icon: SwordsIcon, text: "text-kind-mock" },
  conversation: {
    fill: "bg-kind-conversation",
    icon: MessagesSquareIcon,
    text: "text-kind-conversation",
  },
  // The conversation's teal: speaking and writing are both making something yourself. A cyan read
  // as a second blue beside progress.
  essay: { fill: "bg-kind-conversation", icon: PenLineIcon, text: "text-kind-conversation" },
  // Neutral: the default kind, and no blue to mistake for progress.
  lesson: { fill: "bg-faint", icon: BookOpenIcon, text: "text-muted-foreground" },
  mindMap: { fill: "bg-kind-mind-map", icon: NetworkIcon, text: "text-kind-mind-map" },
  // Review's amber: redoing what went wrong is going back over it. Rose sat beside wrong's pink-red,
  // so a notebook block looked like a wrong answer.
  mistakes: { fill: "bg-kind-review", icon: NotebookPenIcon, text: "text-kind-review" },
  mock: { fill: "bg-kind-mock", icon: TimerIcon, text: "text-kind-mock" },
  // Review's amber: going back over what was learned.
  practice: { fill: "bg-kind-review", icon: DumbbellIcon, text: "text-kind-review" },
  review: { fill: "bg-kind-review", icon: RotateCcwIcon, text: "text-kind-review" },
} as const satisfies Readonly<Record<LearnKind, KindMarks>>;

/** A kind's color as text, for something drawn in it (a mock's line on the progress chart). */
export function kindTextClass(kind: LearnKind): string {
  return KIND_MARKS[kind].text;
}

/** A kind's color as a fill, for its part of a meter (a day's practice block, a plan's reviews). */
export function kindFillClass(kind: LearnKind): string {
  return KIND_MARKS[kind].fill;
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
      className={cn("size-2 shrink-0 rounded-full", KIND_MARKS[kind].fill, className)}
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
