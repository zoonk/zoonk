import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";
import { type LucideIcon } from "lucide-react";
import { Skeleton } from "./skeleton";

const containerVariants = cva("flex w-full flex-col gap-4 antialiased", {
  defaultVariants: { variant: "default" },
  variants: {
    variant: {
      centered:
        "bg-background mx-auto min-h-dvh max-w-sm items-center justify-center py-4 lg:gap-8",
      default: "",
      grid: "gap-5 px-4 pb-8 **:data-[slot=container-description]:text-base **:data-[slot=container-header]:px-0 **:data-[slot=container-title]:text-2xl **:data-[slot=container-title]:md:text-3xl",
      list: "mx-auto pb-8 lg:max-w-xl lg:py-8",
      narrow: "mx-auto py-4 lg:max-w-xl lg:gap-8 lg:py-16",
    },
  },
});

export type ContainerProps = React.ComponentProps<"main"> & VariantProps<typeof containerVariants>;

export function Container({ children, className, variant }: ContainerProps) {
  return (
    <main className={cn(containerVariants({ variant }), className)} data-slot="container">
      {children}
    </main>
  );
}

const containerHeaderVariants = cva("flex items-center justify-between gap-2 px-4", {
  defaultVariants: { variant: "page" },
  variants: { variant: { page: "pt-0", sidebar: "pt-4" } },
});

export type ContainerHeaderProps = React.ComponentProps<"header"> &
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

export type ContainerHeaderGroupProps = React.ComponentProps<"div">;

export function ContainerHeaderGroup({ children, className }: ContainerHeaderGroupProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)} data-slot="container-header-group">
      {children}
    </div>
  );
}

export type ContainerTitleProps = React.ComponentProps<"h1">;

export function ContainerTitle({ children, className }: ContainerTitleProps) {
  return (
    <h1
      className={cn(
        "text-foreground/90 scroll-m-20 text-lg leading-none font-semibold tracking-tight text-balance",
        className,
      )}
      data-slot="container-title"
    >
      {children}
    </h1>
  );
}

export type ContainerDescriptionProps = React.ComponentProps<"h2">;

export function ContainerDescription({ children, className }: ContainerDescriptionProps) {
  return (
    <h2
      className={cn("text-muted-foreground leading-tight tracking-tight text-pretty", className)}
      data-slot="container-description"
    >
      {children}
    </h2>
  );
}

export type ContainerActionsProps = React.ComponentProps<"div">;

export function ContainerActions({ children, className }: ContainerActionsProps) {
  return <div className={cn("flex items-center gap-2", className)}>{children}</div>;
}

export type ContainerActionProps = useRender.ComponentProps<"a"> & { icon: LucideIcon };

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

export type ContainerBodyProps = React.ComponentProps<"div">;

export function ContainerBody({ children, className }: ContainerBodyProps) {
  return (
    <section
      className={cn("flex w-full flex-1 flex-col gap-4 px-4 pb-4 sm:flex-initial", className)}
    >
      {children}
    </section>
  );
}

export type ContainerHeaderSkeletonProps = { className?: string };

/**
 * Mirrors the real header primitives so streamed titles replace the fallback
 * without changing the header's height, padding, or sibling spacing.
 */
export function ContainerHeaderSkeleton({ className }: ContainerHeaderSkeletonProps) {
  return (
    <ContainerHeader aria-hidden="true" className={className}>
      <ContainerHeaderGroup className="min-w-0 flex-1">
        <Skeleton className="h-4.5 w-1/2 rounded" />
        <Skeleton className="h-5 w-3/4 rounded" />
      </ContainerHeaderGroup>
    </ContainerHeader>
  );
}
