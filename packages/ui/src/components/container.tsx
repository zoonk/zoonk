import { cn } from "@zoonk/ui/lib/utils";
import { FRAME_GUTTER_CLASS } from "./bottom-bar";

export function Container({ children, className }: React.ComponentProps<"main">) {
  return (
    <main className={cn("flex w-full flex-col gap-6 antialiased", className)} data-slot="container">
      {children}
    </main>
  );
}

const PAGE_INSET_CLASS = cn("px-(--page-gutter)", FRAME_GUTTER_CLASS);

type ContainerDescriptionProps = React.ComponentProps<"p">;

export function ContainerDescription({ children, className }: ContainerDescriptionProps) {
  return (
    <p
      className={cn("text-muted-foreground pt-1 text-sm", className)}
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
