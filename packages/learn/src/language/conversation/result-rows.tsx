import { cn } from "@zoonk/ui/lib/utils";
import { LIST_GROUP_CLASS } from "../../_components/list-group";
import { SectionLabel } from "../../_components/section-label";

/**
 * A few facts of a call's result, one per row, flat with a hairline between them and as wide as
 * the step: each criterion with its estimate, the phrases said well, the words to practice.
 */
export function ResultRows({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      className={cn(LIST_GROUP_CLASS, "w-full text-left", className)}
      data-slot="result-rows"
      {...props}
    />
  );
}

/** One row: what it is first, what it's worth at the end. */
export function ResultRow({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      className={cn(
        "flex min-h-11 items-center justify-between gap-3 py-2.5 text-sm text-pretty",
        className,
      )}
      data-slot="result-row"
      {...props}
    />
  );
}

/** A group of rows under its quiet label, inside a result step. */
export function ResultGroup({
  children,
  id,
  label,
}: {
  children: React.ReactNode;
  id: string;
  label: string;
}) {
  return (
    <section aria-labelledby={id} className="flex w-full flex-col gap-1 text-left">
      <SectionLabel id={id}>{label}</SectionLabel>
      {children}
    </section>
  );
}

/** What an estimate rests on, in one quiet line under its step: it's never an official score. */
export function EstimateNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground text-[0.8125rem] leading-snug text-pretty">{children}</p>
  );
}
