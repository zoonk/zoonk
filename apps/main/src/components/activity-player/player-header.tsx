import { ClientLink } from "@/i18n/client-link";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { XIcon } from "lucide-react";

export function PlayerHeader({ className, ...props }: React.ComponentProps<"header">) {
  return (
    <header
      className={cn("flex items-center justify-between p-4", className)}
      data-slot="player-header"
      {...props}
    />
  );
}

export function PlayerCloseLink({
  className,
  href,
  ...props
}: React.ComponentProps<typeof ClientLink>) {
  return (
    <ClientLink
      aria-label="Close"
      className={cn(buttonVariants({ size: "icon", variant: "ghost" }), className)}
      data-slot="player-close-link"
      href={href}
      {...props}
    >
      <XIcon />
    </ClientLink>
  );
}

export function PlayerStepFraction({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("text-muted-foreground text-sm tabular-nums", className)}
      data-slot="player-step-fraction"
      {...props}
    />
  );
}
