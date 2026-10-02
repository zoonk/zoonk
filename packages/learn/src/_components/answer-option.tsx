"use client";

import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";

export const ANSWER_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];

/** The picks of a checkpoint or mock question, one at a time like an exam's answer sheet. */
export function AnswerOptionGroup({ className, ...props }: React.ComponentProps<"div">) {
  const t = useExtracted();

  return (
    <div
      aria-label={t("Answer options")}
      className={cn("flex flex-col gap-2.5", className)}
      data-slot="answer-option-group"
      role="radiogroup"
      {...props}
    />
  );
}

/** One pick, with its letter (or mark) in a circle. Tapping the picked one again clears it. */
export function AnswerOption({
  children,
  className,
  marker,
  picked,
  ...props
}: React.ComponentProps<"button"> & { marker: React.ReactNode; picked: boolean }) {
  return (
    <button
      aria-checked={picked}
      className={cn(
        "border-border bg-background focus-visible:ring-ring/50 enabled:hover:bg-muted flex min-h-12 w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-colors outline-none focus-visible:ring-[3px] disabled:cursor-default",
        "in-data-[mode=fun]:rounded-[18px]",
        picked &&
          "border-foreground ring-foreground/10 in-data-[mode=fun]:border-fun-accent-violet in-data-[mode=fun]:ring-fun-accent-violet/20 ring-2",
        className,
      )}
      data-slot="answer-option"
      role="radio"
      type="button"
      {...props}
    >
      {/* On the answer's first line: the circle is centered on one line of text. */}
      <LineMarker aria-hidden="true">
        <span
          className={cn(
            "bg-muted text-muted-foreground flex size-7 items-center justify-center rounded-full text-xs font-semibold [&_svg]:size-4",
            picked &&
              "bg-foreground text-background in-data-[mode=fun]:bg-fun-accent-violet in-data-[mode=fun]:text-white",
          )}
        >
          {marker}
        </span>
      </LineMarker>
      <span className="min-w-0 flex-1 text-base">{children}</span>
    </button>
  );
}
