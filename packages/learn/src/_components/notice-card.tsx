import { cn } from "@zoonk/ui/lib/utils";
import { SURFACE_CLASS } from "./surface";

const NOTICE_CARD_CLASS = cn(
  SURFACE_CLASS,
  "text-foreground [&>svg]:text-muted-foreground flex items-start gap-3 px-3.5 py-3 text-[0.8125rem] leading-5 ring-inset [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0",
);

export function NoticeCard({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn(NOTICE_CARD_CLASS, className)} data-slot="notice-card" {...props} />;
}

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

export function NoticeCardActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mt-2 flex flex-wrap items-center gap-2 empty:hidden", className)}
      data-slot="notice-card-actions"
      {...props}
    />
  );
}
