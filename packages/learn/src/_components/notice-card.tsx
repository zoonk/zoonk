import { cn } from "@zoonk/ui/lib/utils";
import { SURFACE_CLASS } from "./surface";

/**
 * A note a page wants read before the rest (a proposal for the plan, the plan doesn't fit the time,
 * a subject is out of the plan), TipKit-style on the page's surface: a leading tile (or the buddy's
 * face), a short bold title, the message and its actions under the words: a small primary and a
 * ghost one. A plain note takes an icon and its words as direct children instead. Task screens
 * keep `Callout` for their one rule.
 *
 * ```tsx
 * <NoticeCard>
 *   <NoticeCardLeading><KindTile icon={CalendarClockIcon} kind="lesson" size="sm" /></NoticeCardLeading>
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
export function NoticeCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        SURFACE_CLASS,
        "text-foreground [&>svg]:text-muted-foreground flex items-start gap-3 p-4 text-sm leading-5 [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0",
        className,
      )}
      data-slot="notice-card"
      {...props}
    />
  );
}

/** The notice's tile or face, beside its words. */
export function NoticeCardLeading({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn("flex shrink-0 items-start", className)}
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
      className={cn("text-[0.9375rem] leading-snug font-semibold text-pretty", className)}
      data-slot="notice-card-title"
      {...props}
    />
  );
}

export function NoticeCardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-muted-foreground text-sm leading-relaxed text-pretty", className)}
      data-slot="notice-card-description"
      {...props}
    />
  );
}

/** The notice's answers: a small primary first, then ghost ones. */
export function NoticeCardActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mt-2.5 flex flex-wrap items-center gap-2 empty:hidden", className)}
      data-slot="notice-card-actions"
      {...props}
    />
  );
}
