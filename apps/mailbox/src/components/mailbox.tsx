import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { type ComponentProps } from "react";

export function Mailbox({ className, ...props }: ComponentProps<"main">) {
  return (
    <main
      className={cn(
        "bg-muted/30 text-foreground grid min-h-svh grid-rows-[auto_minmax(0,1fr)] font-sans antialiased",
        className,
      )}
      {...props}
    />
  );
}

export function MailboxHeader({ className, ...props }: ComponentProps<"header">) {
  return (
    <header
      className={cn(
        "border-border bg-background/90 z-10 flex min-h-18 flex-wrap items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur-lg sm:flex-nowrap sm:px-6 sm:py-4",
        className,
      )}
      {...props}
    />
  );
}

export function MailboxIdentity({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex items-center gap-3.5", className)} {...props} />;
}

export function MailboxTitle({ children, className, ...props }: ComponentProps<"h1">) {
  return (
    <h1 className={cn("text-lg font-semibold tracking-tight", className)} {...props}>
      {children}
    </h1>
  );
}

export function MailboxStatus({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "text-muted-foreground inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.06em] uppercase",
        className,
      )}
      {...props}
    />
  );
}

export function MailboxActions({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex items-center gap-2.5 sm:gap-4", className)} {...props} />;
}

export function MailboxButton({
  className,
  variant = "outline",
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn("rounded-lg text-[13px] motion-reduce:transition-none", className)}
      type="button"
      variant={variant}
      {...props}
    />
  );
}

export function MailboxBody({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("min-h-0 md:grid md:grid-cols-[minmax(260px,330px)_minmax(0,1fr)]", className)}
      {...props}
    />
  );
}

export function MailboxInbox({ className, ...props }: ComponentProps<"nav">) {
  return (
    <nav
      className={cn(
        "border-border bg-muted/30 max-h-[38svh] min-h-0 overflow-y-auto border-b md:max-h-none md:border-r md:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

export function MailboxList({ className, ...props }: ComponentProps<"ol">) {
  return <ol className={cn("m-0 list-none p-0", className)} {...props} />;
}

export function MailboxListItem({ className, ...props }: ComponentProps<"li">) {
  return <li className={cn("border-border border-b", className)} {...props} />;
}

export function MailboxMessageButton({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      className={cn(
        "focus-visible:ring-ring aria-pressed:bg-muted hover:bg-muted aria-pressed:before:bg-foreground relative grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 border-0 bg-transparent py-4 pr-4 pl-5 text-left transition-colors outline-none before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:bg-transparent focus-visible:ring-2 focus-visible:ring-inset motion-reduce:transition-none",
        className,
      )}
      type="button"
      {...props}
    />
  );
}

export function MailboxPreview({ className, ...props }: ComponentProps<"article">) {
  return <article className={cn("bg-background min-w-0 overflow-y-auto", className)} {...props} />;
}

export function MailboxEmpty({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("text-muted-foreground", className)} {...props} />;
}
