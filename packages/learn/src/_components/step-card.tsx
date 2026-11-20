import { cn } from "@zoonk/ui/lib/utils";
import { useId } from "react";
import { Eyebrow } from "./eyebrow";

export const STEP_TITLE_SLOT = "step-title";

export function StepCard({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn("flex flex-col items-start gap-5 text-left", className)}
      data-slot="step-card"
      {...props}
    />
  );
}

export function StepHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col items-start gap-1.5 *:data-[slot=eyebrow]:mb-1.5", className)}
      data-slot="step-header"
      {...props}
    />
  );
}

export function StepTitle({ children, className, ...props }: React.ComponentProps<"h1">) {
  return (
    <h1
      className={cn("text-title outline-none", className)}
      data-slot={STEP_TITLE_SLOT}
      tabIndex={-1}
      {...props}
    >
      {children}
    </h1>
  );
}

/**
 * The chip over a step's title, read as part of it: a title that is only a score still names its
 * screen ("Mock exam 1 8 of 8"), and the chip isn't read twice.
 */
export function LabeledStepTitle({
  label,
  ...props
}: React.ComponentProps<typeof StepTitle> & { label: string }) {
  const labelId = useId();
  const titleId = useId();

  return (
    <>
      <Eyebrow aria-hidden="true" id={labelId}>
        {label}
      </Eyebrow>
      <StepTitle aria-labelledby={`${labelId} ${titleId}`} id={titleId} {...props} />
    </>
  );
}

/** A number inside a step's sentence, set to tabular figures like the step's own number. */
export function renderStepNumber(chunks: React.ReactNode) {
  return <span className="tabular-nums">{chunks}</span>;
}

export function StepTitleNumber({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("text-readout text-5xl", className)}
      data-slot="step-title-number"
      {...props}
    />
  );
}

export function StepDetail({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-muted-foreground text-pretty", className)}
      data-slot="step-detail"
      {...props}
    />
  );
}

export function StepRows({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      className={cn("flex w-full flex-col text-left", className)}
      data-slot="step-rows"
      {...props}
    />
  );
}

export function StepRow({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      className={cn(
        "border-border [&>svg]:text-muted-foreground flex min-h-11 items-center gap-3 border-b py-2.75 text-sm last:border-b-0 [&>svg]:size-4 [&>svg]:shrink-0",
        className,
      )}
      data-slot="step-row"
      {...props}
    />
  );
}
