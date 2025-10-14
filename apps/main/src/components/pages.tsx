import { cn } from "@zoonk/ui/lib/utils";

export function PageContainer({
  children,
  className,
}: React.ComponentProps<"main">) {
  return (
    <main className={cn("flex flex-col gap-4 p-4", className)}>{children}</main>
  );
}

export function PageHeader({
  children,
  className,
}: React.ComponentProps<"header">) {
  return (
    <header className={cn("flex flex-col gap-0.5", className)}>
      {children}
    </header>
  );
}

export function PageTitle({ children, className }: React.ComponentProps<"h1">) {
  return (
    <h1
      className={cn(
        "scroll-m-20 text-balance font-semibold text-foreground/90 text-xl leading-none tracking-tight",
        className,
      )}
    >
      {children}
    </h1>
  );
}

export const PageSubtitle = ({
  children,
  className,
}: React.ComponentProps<"h2">) => (
  <h2
    className={cn(
      "text-balance text-muted-foreground tracking-tight",
      className,
    )}
  >
    {children}
  </h2>
);
