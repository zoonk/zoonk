import { cn } from "@zoonk/ui/lib/utils";

export function Container({ children, className }: React.ComponentProps<"main">) {
  return (
    <main className={cn("flex w-full flex-col gap-6 antialiased", className)} data-slot="container">
      {children}
    </main>
  );
}

const PAGE_INSET_CLASS = "px-4 sm:px-8 lg:px-10";

type ContainerDescriptionProps = React.ComponentProps<"p">;

export function ContainerDescription({ children, className }: ContainerDescriptionProps) {
  return (
    <p
      className={cn("text-muted-foreground pt-1 text-sm text-pretty", className)}
      data-slot="container-description"
    >
      {children}
    </p>
  );
}

type ContainerBodyProps = React.ComponentProps<"div">;

export function ContainerBody({ children, className }: ContainerBodyProps) {
  return (
    <section
      className={cn(
        "flex w-full flex-1 flex-col gap-4 pb-12 sm:flex-initial lg:pb-16",
        PAGE_INSET_CLASS,
        className,
      )}
    >
      {children}
    </section>
  );
}
