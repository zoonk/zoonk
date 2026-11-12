import { cn } from "@zoonk/ui/lib/utils";
import { LESSON_BODY_CLASS } from "./lesson-step-text";

/** One numbered line of a reading screen: a worked example's step, a summary's idea. */
export function NumberedLine({
  children,
  className,
  number,
}: {
  children: React.ReactNode;
  className?: string;
  number: number;
}) {
  return (
    <li className={cn("flex items-baseline gap-3", className)} data-slot="numbered-line">
      <span
        aria-hidden="true"
        className="text-muted-foreground w-4 shrink-0 font-mono text-sm tabular-nums"
      >
        {number}
      </span>
      <div className={cn(LESSON_BODY_CLASS, "flex min-w-0 flex-1 flex-col gap-1")}>{children}</div>
    </li>
  );
}
