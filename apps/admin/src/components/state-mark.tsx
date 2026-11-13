import { toWords } from "@/lib/format";
import { cn } from "@zoonk/ui/lib/utils";
import {
  BanIcon,
  CheckIcon,
  CircleDashedIcon,
  CircleXIcon,
  type LucideIcon,
  TriangleAlertIcon,
} from "lucide-react";

/**
 * What a state means, which decides its mark and color on every page: done is the blue check the
 * learner apps use, going on a blue dot with a halo, waiting an open ring, not read yet a dot in
 * the text color, something to look at amber, failed or blocked pink-red, and switched off or over
 * gray.
 */
export type StateTone = "attention" | "done" | "failed" | "going" | "off" | "unread" | "waiting";

const TONE_ICON: Record<Exclude<StateTone, "going" | "unread">, LucideIcon> = {
  attention: TriangleAlertIcon,
  done: CheckIcon,
  failed: CircleXIcon,
  off: BanIcon,
  waiting: CircleDashedIcon,
};

const TONE_MARK_CLASS: Record<StateTone, string> = {
  attention: "text-warning",
  done: "text-success",
  failed: "text-destructive",
  going: "text-success",
  off: "text-faint",
  unread: "text-foreground",
  waiting: "text-muted-foreground",
};

const TONE_TEXT_CLASS: Partial<Record<StateTone, string>> = {
  attention: "text-warning-text",
  failed: "text-destructive-text",
  unread: "text-foreground font-medium",
};

/**
 * Every stored state Admin shows, by what it means. A state missing here reads as waiting, so a
 * new one is visible instead of wrongly colored.
 */
const STATE_TONES: Record<string, StateTone> = {
  abandoned: "off",
  active: "going",
  applied: "done",
  approved: "done",
  archived: "off",
  banned: "failed",
  canceled: "off",
  completed: "done",
  deleted: "off",
  dismissed: "off",
  failed: "failed",
  incomplete: "attention",
  learning: "going",
  mastered: "done",
  new: "unread",
  open: "attention",
  past_due: "attention",
  paused: "off",
  pending: "waiting",
  planned: "waiting",
  proposed: "waiting",
  quarantined: "attention",
  read: "done",
  rejected: "off",
  replied: "done",
  running: "going",
  skipped: "off",
  solid: "done",
  stuck: "attention",
  superseded: "off",
  trialing: "going",
  unpaid: "attention",
};

function getStateTone(state: string): StateTone {
  return STATE_TONES[state] ?? "waiting";
}

/** Inline, so the word keeps the text's baseline in a table row; the mark hangs centered on its capitals. */
const MARK_CLASS = "me-1.5 inline-block size-3.5 shrink-0 align-[-0.15em]";

function ToneMark({ tone }: { tone: StateTone }) {
  if (tone === "going" || tone === "unread") {
    return (
      <span aria-hidden="true" className={cn(MARK_CLASS, "relative")}>
        <span
          className={cn(
            "absolute inset-0 m-auto size-2 rounded-full",
            tone === "going" ? "bg-success ring-success/25 ring-3" : "bg-foreground",
          )}
        />
      </span>
    );
  }

  const Icon = TONE_ICON[tone];

  return <Icon aria-hidden="true" className={cn(MARK_CLASS, TONE_MARK_CLASS[tone])} />;
}

/**
 * A state as its mark and its word. `state` is the stored code; `children` replaces the word where
 * the page has a better one ("Written" for `completed`), and `tone` the meaning where the same code
 * means something else on that page.
 */
export function StateMark({
  children,
  className,
  state,
  tone = getStateTone(state),
}: {
  children?: React.ReactNode;
  className?: string;
  state: string;
  tone?: StateTone;
}) {
  return (
    <span
      className={cn("whitespace-nowrap", TONE_TEXT_CLASS[tone], className)}
      data-slot="state-mark"
      data-tone={tone}
    >
      <ToneMark tone={tone} />
      {children ?? toWords(state)}
    </span>
  );
}
