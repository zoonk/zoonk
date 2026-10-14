import { cn } from "@zoonk/ui/lib/utils";
import { SURFACE_CLASS } from "./surface";

/**
 * A note inside a page (the plan doesn't fit the time, a subject is out of the plan, Plus opens
 * this), compact: a 16px icon, what it's about in a few words, the message in one or two quiet
 * lines and its answers under them, small: a primary and a secondary. A plain note takes an icon
 * and its words as direct children instead. The one thing a page wants the learner to know or
 * decide (Today's notice) is a `Suggestion`, a line or a panel; task screens keep `Callout` for
 * their one rule. The frame is the hairline every panel has.
 *
 * ```tsx
 * <NoticeCard>
 *   <NoticeCardLeading><SparklesIcon /></NoticeCardLeading>
 *   <NoticeCardContent>
 *     <NoticeCardTitle>To study everything in depth: 1 h a day</NoticeCardTitle>
 *     <NoticeCardDescription>45 min a day studies every topic…</NoticeCardDescription>
 *     <NoticeCardActions>
 *       <Button size="sm">Switch to 1 h a day</Button>
 *       <Button size="sm" variant="ghost">Choose where to focus</Button>
 *     </NoticeCardActions>
 *   </NoticeCardContent>
 * </NoticeCard>
 * ```
 */
/** The card's frame, for a notice that renders its own element (a `section`, a form). */
const NOTICE_CARD_CLASS = cn(
  SURFACE_CLASS,
  "text-foreground [&>svg]:text-muted-foreground flex items-start gap-3 px-3.5 py-3 text-[0.8125rem] leading-5 ring-inset [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0",
);

export function NoticeCard({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn(NOTICE_CARD_CLASS, className)} data-slot="notice-card" {...props} />;
}

/** The notice's icon (amber, as a suggestion's sparkle), beside its words. */
export function NoticeCardLeading({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn("text-warning flex shrink-0 items-start pt-0.5 [&>svg]:size-4", className)}
      data-slot="notice-card-leading"
      {...props}
    />
  );
}

export function NoticeCardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-w-0 flex-1 flex-col gap-0.5", className)}
      data-slot="notice-card-content"
      {...props}
    />
  );
}

/** What the notice is about, in a few words. */
export function NoticeCardTitle({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-sm leading-snug font-medium text-pretty", className)}
      data-slot="notice-card-title"
      {...props}
    />
  );
}

export function NoticeCardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-muted-foreground text-[0.8125rem] leading-snug text-pretty", className)}
      data-slot="notice-card-description"
      {...props}
    />
  );
}

/** The notice's answers, small: a primary first, then secondary (`outline`) ones. */
export function NoticeCardActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mt-2 flex flex-wrap items-center gap-2 empty:hidden", className)}
      data-slot="notice-card-actions"
      {...props}
    />
  );
}
