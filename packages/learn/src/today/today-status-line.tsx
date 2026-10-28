import { cn } from "@zoonk/ui/lib/utils";

/** A status, so a day that changes while the learner is here (lessons that arrive) is announced. */
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

export function TodayStatusSentence({ children }: { children: React.ReactNode }) {
  return <span className="font-medium">{children} </span>;
}

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
