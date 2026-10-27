import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowUpIcon } from "lucide-react";

type GridBackToTopProps = Omit<React.ComponentProps<"a">, "href"> & { href?: string };

/**
 * Back-to-top is a normal anchor because grid pages only need a quiet way back
 * to the page header, and keeping the behavior browser-native avoids scroll
 * state or page-specific client logic.
 */
export function GridBackToTop({
  children,
  className,
  href = "#top",
  ...props
}: GridBackToTopProps) {
  return (
    <a
      className={cn(
        buttonVariants({ size: "sm", variant: "ghost" }),
        "text-muted-foreground hover:text-foreground px-2 text-xs",
        className,
      )}
      data-slot="grid-back-to-top"
      href={href}
      {...props}
    >
      <ArrowUpIcon aria-hidden="true" className="size-3.5" />
      {children}
    </a>
  );
}
