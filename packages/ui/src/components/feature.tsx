import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@zoonk/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";
import { ChevronRightIcon } from "lucide-react";

function FeatureCardSectionTitle({ children, className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn("text-muted-foreground text-xs font-medium tracking-wide uppercase", className)}
      data-slot="feature-card-section-title"
      {...props}
    >
      {children}
    </h2>
  );
}

function FeatureCard({ children, className, ...props }: React.ComponentProps<"article">) {
  return (
    <article className={cn("flex flex-col gap-2", className)} data-slot="feature-card" {...props}>
      {children}
    </article>
  );
}

type FeatureCardLinkProps = useRender.ComponentProps<"a">;

function FeatureCardLink({ className, render, ...props }: FeatureCardLinkProps) {
  return useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(
      {
        className: cn(
          "hover:bg-muted/50 focus-visible:ring-ring -m-2 block rounded-lg p-2 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          className,
        ),
      },
      props,
    ),
    render,
    state: {
      slot: "feature-card-link",
    },
  });
}

function FeatureCardHeader({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("text-muted-foreground flex items-center justify-between", className)}
      data-slot="feature-card-header"
      {...props}
    >
      {children}
    </div>
  );
}

function FeatureCardHeaderContent({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      data-slot="feature-card-header-content"
      {...props}
    >
      {children}
    </div>
  );
}

function FeatureCardIcon({ children, className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn("flex shrink-0 [&>svg]:size-4", className)}
      data-slot="feature-card-icon"
      {...props}
    >
      {children}
    </span>
  );
}

function FeatureCardLabel({ children, className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      className={cn("truncate text-sm font-medium transition-colors", className)}
      data-slot="feature-card-label"
      {...props}
    >
      {children}
    </h3>
  );
}

function FeatureCardIndicator({ className }: { className?: string }) {
  return (
    <ChevronRightIcon
      aria-hidden="true"
      className={cn("size-4 shrink-0 transition-colors", className)}
      data-slot="feature-card-indicator"
    />
  );
}

function FeatureCardContent({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex gap-3", className)} data-slot="feature-card-content" {...props}>
      {children}
    </div>
  );
}

const featureCardThumbnailVariants = cva("relative shrink-0 overflow-hidden", {
  defaultVariants: {
    rounded: "lg",
    size: "md",
  },
  variants: {
    rounded: {
      "2xl": "rounded-2xl",
      lg: "rounded-lg",
      xl: "rounded-xl",
    },
    size: {
      lg: "size-24",
      md: "size-20",
      sm: "size-16",
    },
  },
});

type FeatureCardThumbnailProps = React.ComponentProps<"div"> &
  VariantProps<typeof featureCardThumbnailVariants>;

function FeatureCardThumbnail({
  children,
  className,
  rounded,
  size,
  ...props
}: FeatureCardThumbnailProps) {
  return (
    <div
      className={cn(featureCardThumbnailVariants({ className, rounded, size }))}
      data-slot="feature-card-thumbnail"
      {...props}
    >
      {children}
    </div>
  );
}

function FeatureCardThumbnailImage({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "size-full transition-transform duration-300 ease-out [&>img]:size-full [&>img]:object-cover",
        className,
      )}
      data-slot="feature-card-thumbnail-image"
      {...props}
    >
      {children}
    </div>
  );
}

function FeatureCardThumbnailPlaceholder({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-muted [&>svg]:text-muted-foreground/60 flex size-full items-center justify-center transition-transform duration-300 ease-out [&>svg]:size-6",
        className,
      )}
      data-slot="feature-card-thumbnail-placeholder"
      {...props}
    >
      {children}
    </div>
  );
}

function FeatureCardBody({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-w-0 flex-1 flex-col gap-0.5", className)}
      data-slot="feature-card-body"
      {...props}
    >
      {children}
    </div>
  );
}

function FeatureCardTitle({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "text-foreground/90 [&>a]:hover:text-foreground truncate text-base leading-none font-semibold [&>a]:underline-offset-1 [&>a]:transition-colors [&>a]:hover:underline",
        className,
      )}
      data-slot="feature-card-title"
      {...props}
    >
      {children}
    </div>
  );
}

function FeatureCardSubtitle({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "text-muted-foreground [&>a]:hover:text-muted-foreground/80 mb-0.5 truncate text-sm tracking-tight [&>a]:underline-offset-2 [&>a]:transition-colors [&>a]:hover:underline",
        className,
      )}
      data-slot="feature-card-subtitle"
      {...props}
    >
      {children}
    </div>
  );
}

function FeatureCardDescription({ children, className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-muted-foreground/80 line-clamp-3 text-xs", className)}
      data-slot="feature-card-description"
      {...props}
    >
      {children}
    </p>
  );
}

export {
  FeatureCard,
  FeatureCardBody,
  FeatureCardContent,
  FeatureCardDescription,
  FeatureCardHeader,
  FeatureCardHeaderContent,
  FeatureCardIcon,
  FeatureCardIndicator,
  FeatureCardLabel,
  FeatureCardLink,
  FeatureCardSectionTitle,
  FeatureCardSubtitle,
  FeatureCardThumbnail,
  FeatureCardThumbnailImage,
  FeatureCardThumbnailPlaceholder,
  FeatureCardTitle,
  type FeatureCardLinkProps,
  type FeatureCardThumbnailProps,
};
