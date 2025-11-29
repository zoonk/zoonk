import { cn } from "@zoonk/ui/lib/utils";

export function Header({
  children,
  className,
}: React.ComponentProps<"header">) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex items-center justify-between gap-2 bg-background/80 p-4 backdrop-blur-md",
        className,
      )}
    >
      {children}
    </header>
  );
}
