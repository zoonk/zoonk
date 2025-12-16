import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
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
      list: "mx-auto gap-1 pb-4 lg:max-w-xl lg:py-8",
      narrow: "mx-auto py-4 lg:max-w-xl lg:gap-8 lg:py-16",
    },
  },
});

export type ContainerProps = React.ComponentProps<"main"> &
  VariantProps<typeof containerVariants>;

export function Container({ children, className, variant }: ContainerProps) {
  return (
    <main className={cn(containerVariants({ variant }), className)}>
      {children}
    </main>
  );
}

const containerHeaderVariants = cva(
  "flex items-center justify-between gap-2 px-4",
  {
    defaultVariants: {
      variant: "page",
    },
    variants: {
      variant: {
        page: "pt-0",
        sidebar: "pt-4",
      },
    },
  },
);

export type ContainerHeaderProps = React.ComponentProps<"header"> &
  VariantProps<typeof containerHeaderVariants>;

export function ContainerHeader({
  children,
  className,
  variant,
}: ContainerHeaderProps) {
  return (
    <header className={cn(containerHeaderVariants({ variant }), className)}>
      {children}
    </header>
  );
}

export type ContainerHeaderGroupProps = React.ComponentProps<"div">;

export function ContainerHeaderGroup({
  children,
  className,
}: ContainerHeaderGroupProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>{children}</div>
  );
}

export type ContainerTitleProps = React.ComponentProps<"h1">;

export function ContainerTitle({ children, className }: ContainerTitleProps) {
  return (
    <h1
      className={cn(
        "scroll-m-20 text-balance font-semibold text-base text-foreground/90 leading-none tracking-tight",
        className,
      )}
    >
      {children}
    </h1>
  );
}

export type ContainerDescriptionProps = React.ComponentProps<"h2">;

export function ContainerDescription({
  children,
  className,
}: ContainerDescriptionProps) {
  return (
    <h2
      className={cn(
        "text-pretty text-muted-foreground text-sm leading-none tracking-tight",
        className,
      )}
    >
      {children}
    </h2>
  );
}

export type ContainerActionsProps = React.ComponentProps<"div">;

export function ContainerActions({
  children,
  className,
}: ContainerActionsProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>{children}</div>
  );
}

export type ContainerActionProps = useRender.ComponentProps<"a"> & {
  icon: LucideIcon;
};

export function ContainerAction({
  icon: Icon,
  children,
  className,
  render,
  ...props
}: ContainerActionProps) {
  return useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(
      {
        className: cn(
          buttonVariants({ size: "adaptive", variant: "outline" }),
          className,
        ),
      },
      {
        ...props,
        children: (
          <>
            <Icon aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">{children}</span>
          </>
        ),
      },
    ),
    render,
    state: {
      slot: "container-action",
    },
  });
}

export type ContainerBodyProps = React.ComponentProps<"div">;

export function ContainerBody({ children, className }: ContainerBodyProps) {
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

export type ContainerHeaderSkeletonProps = {
  className?: string;
};

export function ContainerHeaderSkeleton({
  className,
}: ContainerHeaderSkeletonProps) {
  return (
    <header className={cn("flex flex-col gap-1", className)}>
      <Skeleton className="mb-1 h-6 w-1/2" />
      <Skeleton className="h-4 w-1/3" />
    </header>
  );
}
