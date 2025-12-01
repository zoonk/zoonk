import { cn } from "@zoonk/ui/lib/utils";

export function Container({
  children,
  className,
  isForm = false,
}: React.ComponentProps<"main"> & { isForm?: boolean }) {
  return (
    <main
      className={cn(
        "flex flex-col gap-4 p-4",
        {
          "mx-auto w-full max-w-lg lg:py-8": isForm,
        },
        className,
      )}
    >
      {children}
    </main>
  );
}

export function ContainerHeader({
  children,
  className,
}: React.ComponentProps<"header">) {
  return (
    <header className={cn("flex flex-col gap-0.5", className)}>
      {children}
    </header>
  );
}

export function ContainerTitle({
  children,
  className,
}: React.ComponentProps<"h1">) {
  return (
    <h1
      className={cn(
        "scroll-m-20 text-balance pb-0.5 font-semibold text-foreground/90 text-xl leading-none tracking-tight",
        className,
      )}
    >
      {children}
    </h1>
  );
}

export const ContainerDescription = ({
  children,
  className,
}: React.ComponentProps<"h2">) => (
  <h2
    className={cn(
      "text-balance text-muted-foreground leading-snug tracking-tight",
      className,
    )}
  >
    {children}
  </h2>
);
