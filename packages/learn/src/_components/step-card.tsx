import { cn } from "@zoonk/ui/lib/utils";
import { PageEyebrow } from "./page";

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
      className={cn("flex flex-col items-start gap-1.5", className)}
      data-slot="step-header"
      {...props}
    />
  );
}

export function StepEyebrow({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <PageEyebrow className={cn("text-balance", className)} data-slot="step-eyebrow" {...props} />
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

export function StepTitleNumber({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("text-readout text-5xl", className)}
      data-slot="step-title-number"
      {...props}
    />
  );
}

export function StepTitleLabel({ children, className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("text-muted-foreground text-sm font-medium tracking-normal", className)}
      data-slot="step-title-label"
      {...props}
    >
      {" "}
      {children}{" "}
    </span>
  );
}

export function StepDetail({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-muted-foreground text-balance", className)}
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
