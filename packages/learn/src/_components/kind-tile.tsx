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

type KindMarks = { fill: string; icon: LucideIcon; text: string };

/**
 * Kinds that do the same job share a hue and differ by their icon: review, practice and mistakes
 * go back over what was learned, a mock and a challenge test what the learner knows, and an essay
 * makes something as a conversation does.
 */
const KIND_MARKS = {
  challenge: { fill: "bg-kind-mock", icon: SwordsIcon, text: "text-kind-mock" },
  conversation: {
    fill: "bg-kind-conversation",
    icon: MessagesSquareIcon,
    text: "text-kind-conversation",
  },
  essay: { fill: "bg-kind-conversation", icon: PenLineIcon, text: "text-kind-conversation" },
  lesson: { fill: "bg-faint", icon: BookOpenIcon, text: "text-muted-foreground" },
  mindMap: { fill: "bg-kind-mind-map", icon: NetworkIcon, text: "text-kind-mind-map" },
  mistakes: { fill: "bg-kind-review", icon: NotebookPenIcon, text: "text-kind-review" },
  mock: { fill: "bg-kind-mock", icon: TimerIcon, text: "text-kind-mock" },
  practice: { fill: "bg-kind-review", icon: DumbbellIcon, text: "text-kind-review" },
  review: { fill: "bg-kind-review", icon: RotateCcwIcon, text: "text-kind-review" },
} as const satisfies Readonly<Record<LearnKind, KindMarks>>;

export function kindTextClass(kind: LearnKind): string {
  return KIND_MARKS[kind].text;
}

export function kindFillClass(kind: LearnKind): string {
  return KIND_MARKS[kind].fill;
}

export function KindDot({ className, kind }: { className?: string; kind: LearnKind }) {
  return (
    <span
      aria-hidden="true"
      className={cn("size-2 shrink-0 rounded-full", KIND_MARKS[kind].fill, className)}
      data-slot="kind-dot"
    />
  );
}

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

export function KindMark({ className, kind }: { className?: string; kind: LearnKind }) {
  return <KindIcon className={cn("size-3.5", className)} kind={kind} />;
}
