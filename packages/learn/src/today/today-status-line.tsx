import { cn } from "@zoonk/ui/lib/utils";

/**
 * What the day is when there's nothing to start, in one line between hairlines: a 16px muted icon
 * (the done mark for a finished day), a sentence and a quieter clause after it ("No study
 * planned today. Enjoy your day off."). Every state of Today uses it, under the same title and
 * queue, so a rest day, a paused goal or a finished day never changes the page's frame. It's a
 * status: a day that changes while the learner is here (lessons that arrive) is announced.
 *
 * ```tsx
 * <TodayStatusLine icon={<MoonIcon />}>
 *   <TodayStatusSentence>No study planned today.</TodayStatusSentence>
 *   <TodayStatusClause>Enjoy your day off.</TodayStatusClause>
 * </TodayStatusLine>
 * ```
 */
export function TodayStatusLine({
  children,
  className,
  icon,
}: {
  children: React.ReactNode;
  className?: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className={cn("flex items-start gap-3 border-y py-3", className)}
      data-slot="today-status-line"
      role="status"
    >
      <span
        aria-hidden="true"
        className="text-muted-foreground flex h-5 w-5 shrink-0 items-center justify-center [&>svg]:size-4"
      >
        {icon}
      </span>
      <p className="min-w-0 text-sm leading-5 text-pretty">{children}</p>
    </div>
  );
}

/** The status's sentence, in the text color. */
export function TodayStatusSentence({ children }: { children: React.ReactNode }) {
  return <span className="font-medium">{children} </span>;
}

/** The quieter clause after the sentence: what it means, or the day's time in the mono face. */
export function TodayStatusClause({
  children,
  mono = false,
}: {
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <span
      className={cn(
        "text-muted-foreground",
        mono && "font-mono text-[0.8125rem] whitespace-nowrap tabular-nums",
      )}
    >
      {children}
    </span>
  );
}
