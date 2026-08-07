import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { type ComponentProps } from "react";

/** Provides the full-height surface that anchors every mailbox region. */
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

/** Keeps mailbox identity and global actions in one compact top bar. */
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

/** Groups the title with live delivery status without coupling their content. */
export function MailboxIdentity({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex items-center gap-3.5", className)} {...props} />;
}

/** Gives this development tool a single, immediately recognizable heading. */
export function MailboxTitle({ children, className, ...props }: ComponentProps<"h1">) {
  return (
    <h1 className={cn("text-lg font-semibold tracking-tight", className)} {...props}>
      {children}
    </h1>
  );
}

/** Displays compact operational metadata in a developer-friendly monospace face. */
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

/** Keeps global mailbox controls aligned separately from the inbox identity. */
export function MailboxActions({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex items-center gap-2.5 sm:gap-4", className)} {...props} />;
}

/** Reuses the shared outline action so this app follows the same interaction states as every app. */
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

/** Creates the two-region inbox and message layout used by the local tool. */
export function MailboxBody({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("min-h-0 md:grid md:grid-cols-[minmax(260px,330px)_minmax(0,1fr)]", className)}
      {...props}
    />
  );
}

/** Marks the message list as navigation for assistive technology and small screens. */
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

/** Resets list chrome so spacing and dividers carry the inbox hierarchy. */
export function MailboxList({ className, ...props }: ComponentProps<"ol">) {
  return <ol className={cn("m-0 list-none p-0", className)} {...props} />;
}

/** Makes each captured message one semantic list item. */
export function MailboxListItem({ className, ...props }: ComponentProps<"li">) {
  return <li className={cn("border-border border-b", className)} {...props} />;
}

/** Turns an entire message summary into one keyboard-accessible selection target. */
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

/** Holds the selected email's headers and safely isolated body preview. */
export function MailboxPreview({ className, ...props }: ComponentProps<"article">) {
  return <article className={cn("bg-background min-w-0 overflow-y-auto", className)} {...props} />;
}

/** Gives empty inbox states enough visual weight to explain the next action. */
export function MailboxEmpty({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("text-muted-foreground", className)} {...props} />;
}
