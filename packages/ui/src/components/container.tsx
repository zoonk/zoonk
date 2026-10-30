import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";
import { type LucideIcon } from "lucide-react";
import { Skeleton } from "./skeleton";

const containerVariants = cva("flex w-full flex-col gap-6 antialiased", {
  defaultVariants: { variant: "default" },
  variants: {
    variant: {
      centered:
        "bg-background mx-auto min-h-dvh max-w-sm items-center justify-center py-4 lg:gap-8",
      default: "",
    },
  },
});

type ContainerProps = React.ComponentProps<"main"> & VariantProps<typeof containerVariants>;

export function Container({ children, className, variant }: ContainerProps) {
  return (
    <main className={cn(containerVariants({ variant }), className)} data-slot="container">
      {children}
    </main>
  );
}

const PAGE_INSET_CLASS = "px-4 sm:px-8 lg:px-10";

const containerHeaderVariants = cva(cn("flex items-end justify-between gap-4", PAGE_INSET_CLASS), {
  defaultVariants: { variant: "page" },
  variants: {
    variant: {
      page: "pt-0",
      sidebar: "pt-4 sm:pt-6 lg:pt-8 [&_[data-slot=container-title]:first-child]:pt-5",
    },
  },
});

type ContainerHeaderProps = React.ComponentProps<"header"> &
  VariantProps<typeof containerHeaderVariants>;

export function ContainerHeader({ children, className, variant }: ContainerHeaderProps) {
  return (
    <header
      className={cn(containerHeaderVariants({ variant }), className)}
      data-slot="container-header"
    >
      {children}
    </header>
  );
}

type ContainerHeaderGroupProps = React.ComponentProps<"div">;

export function ContainerHeaderGroup({ children, className }: ContainerHeaderGroupProps) {
  return (
    <div
      className={cn("flex min-w-0 flex-col gap-1", className)}
      data-slot="container-header-group"
    >
      {children}
    </div>
  );
}

type ContainerTitleProps = React.ComponentProps<"h1">;

export function ContainerTitle({ children, className }: ContainerTitleProps) {
  return (
    <h1 className={cn("text-title", className)} data-slot="container-title">
      {children}
    </h1>
  );
}

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

type ContainerActionsProps = React.ComponentProps<"div">;

export function ContainerActions({ children, className }: ContainerActionsProps) {
  return <div className={cn("flex items-center gap-2", className)}>{children}</div>;
}

type ContainerActionProps = useRender.ComponentProps<"a"> & { icon: LucideIcon };

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
      { className: cn(buttonVariants({ size: "adaptive", variant: "outline" }), className) },
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
    state: { slot: "container-action" },
  });
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

type ContainerHeaderSkeletonProps = { className?: string };

export function ContainerHeaderSkeleton({ className }: ContainerHeaderSkeletonProps) {
  return (
    <ContainerHeader aria-hidden="true" className={className}>
      <ContainerHeaderGroup className="min-w-0 flex-1">
        <Skeleton className="h-8 w-1/3 rounded" />
        <Skeleton className="mt-1 h-5 w-1/2 rounded" />
      </ContainerHeaderGroup>
    </ContainerHeader>
  );
}
