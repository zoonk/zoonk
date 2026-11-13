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

/** The page's top over the panes, on the shared page top: the status and Clear inbox in its bar. */
export function MailboxTop({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "border-border bg-background border-b px-(--page-gutter) pb-4 [--page-gutter:1rem] md:[--page-gutter:1.5rem]",
        className,
      )}
      {...props}
    />
  );
}

export function MailboxStatus({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn("text-muted-foreground inline-flex items-center gap-2 text-sm", className)}
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
  return (
    <li className={cn("border-border border-b max-md:last:border-b-0", className)} {...props} />
  );
}

export function MailboxMessageButton({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      className={cn(
        "focus-visible:ring-ring aria-pressed:bg-muted hover:bg-muted grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-2 border-0 bg-transparent px-4 py-4 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset motion-reduce:transition-none md:px-6",
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
  return (
    <div
      className={cn(
        "text-muted-foreground bg-background flex flex-col items-center justify-center gap-1.5 px-6 py-16 text-center",
        className,
      )}
      {...props}
    />
  );
}
