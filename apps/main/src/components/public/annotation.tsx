import { cn } from "@zoonk/ui/lib/utils";

/** Decorative: the caption says what it points at. */
export function AnnotationMark({ children, className }: { children: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "ring-input text-muted-foreground inline-grid size-5 shrink-0 place-items-center rounded-full font-mono text-[0.6875rem] leading-none font-semibold ring-[1.25px] ring-inset",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function AnnotationCaptions({ className, ...props }: React.ComponentProps<"ol">) {
  return (
    <ol
      className={cn("grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-4 lg:gap-6", className)}
      data-slot="annotation-captions"
      {...props}
    />
  );
}

export function AnnotationCaption({
  children,
  number,
  title,
}: {
  children: React.ReactNode;
  number: number;
  title: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <AnnotationMark>{number}</AnnotationMark>
      <span className="flex min-w-0 flex-col gap-0.5 text-sm leading-5">
        <span className="font-semibold text-pretty">{title}</span>
        <span className="text-muted-foreground text-pretty">{children}</span>
      </span>
    </li>
  );
}
