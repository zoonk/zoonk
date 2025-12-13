import { cn } from "@zoonk/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Skeleton } from "./skeleton";

const containerVariants = cva("flex w-full flex-col gap-4 antialiased", {
  defaultVariants: {
    variant: "default",
  },
  variants: {
    variant: {
      centered:
        "mx-auto min-h-dvh max-w-sm items-center justify-center bg-background py-4 lg:gap-8",
      default: "",
      list: "mx-auto pb-4 lg:max-w-xl lg:py-8",
      narrow: "mx-auto py-4 lg:max-w-xl lg:gap-8 lg:py-16",
    },
  },
});

export function Container({
  children,
  className,
  variant,
}: React.ComponentProps<"main"> & VariantProps<typeof containerVariants>) {
  return (
    <main className={cn(containerVariants({ variant }), className)}>
      {children}
    </main>
  );
}

const containerHeaderVariants = cva("flex flex-col gap-2 px-4", {
  defaultVariants: {
    variant: "page",
  },
  variants: {
    variant: {
      page: "pt-0",
      sidebar: "pt-4",
    },
  },
});

export function ContainerHeader({
  children,
  className,
  variant,
}: React.ComponentProps<"header"> &
  VariantProps<typeof containerHeaderVariants>) {
  return (
    <header className={cn(containerHeaderVariants({ variant }), className)}>
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
        "scroll-m-20 text-balance font-semibold text-foreground/90 text-xl leading-none tracking-tight",
        className,
      )}
    >
      {children}
    </h1>
  );
}

export function ContainerDescription({
  children,
  className,
}: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn(
        "text-pretty text-muted-foreground leading-snug tracking-tight",
        className,
      )}
    >
      {children}
    </h2>
  );
}

export function ContainerBody({
  children,
  className,
}: React.ComponentProps<"div">) {
  return (
    <section
      className={cn(
        "flex w-full flex-1 flex-col gap-4 px-4 sm:flex-initial",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function ContainerHeaderSkeleton({ className }: { className?: string }) {
  return (
    <header className={cn("flex flex-col gap-0.5", className)}>
      <Skeleton className="mb-1 h-6 w-1/2" />
      <Skeleton className="h-4 w-1/3" />
    </header>
  );
}
