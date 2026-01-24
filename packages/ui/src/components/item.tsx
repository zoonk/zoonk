import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { Separator } from "@zoonk/ui/components/separator";
import { cn } from "@zoonk/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";
import type * as React from "react";

const itemGroupVariants = cva(
  "group/item-group flex w-full flex-col gap-4 has-data-[size=sm]:gap-2.5 has-data-[size=xs]:gap-2 has-data-[variant=default]:gap-0",
  {
    defaultVariants: {
      layout: "list",
    },
    variants: {
      layout: {
        grid: "md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-4 xl:grid-cols-3 2xl:grid-cols-4",
        list: "",
      },
    },
  },
);

type ItemGroupProps = React.ComponentProps<"div"> & VariantProps<typeof itemGroupVariants>;

function ItemGroup({ className, layout, ...props }: ItemGroupProps) {
  return (
    <div
      className={cn(itemGroupVariants({ layout }), className)}
      data-slot="item-group"
      role="list"
      {...props}
    />
  );
}

function ItemSeparator({ className, ...props }: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      className={cn("my-2", className)}
      data-slot="item-separator"
      orientation="horizontal"
      {...props}
    />
  );
}

const itemVariants = cva(
  "group/item focus-visible:border-ring focus-visible:ring-ring/50 [a]:hover:bg-muted flex w-full flex-wrap items-center rounded-2xl border text-sm transition-colors duration-100 outline-none focus-visible:ring-[3px] [a]:transition-colors",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default: "gap-3.5 px-4 py-3.5",
        sm: "gap-3.5 px-3.5 py-3",
        xs: "gap-2.5 px-3 py-2.5 [[data-slot=dropdown-menu-content]_&]:p-0",
      },
      variant: {
        default: "border-transparent",
        muted: "bg-muted/50 border-transparent",
        outline: "border-border",
      },
    },
  },
);

type ItemProps = useRender.ComponentProps<"div"> & VariantProps<typeof itemVariants>;

function Item({ className, variant = "default", size = "default", render, ...props }: ItemProps) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(itemVariants({ className, size, variant })),
      },
      props,
    ),
    render,
    state: {
      size,
      slot: "item",
      variant,
    },
  });
}

const itemMediaVariants = cva(
  "flex shrink-0 items-center justify-center gap-2 group-has-[[data-slot=item-description]]/item:translate-y-0.5 group-has-[[data-slot=item-description]]/item:self-start [&_svg]:pointer-events-none",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "bg-muted/70 rounded-lg [&_svg:not([class*='size-'])]:size-4",
        image:
          "size-10 overflow-hidden rounded-lg group-data-[size=sm]/item:size-8 group-data-[size=xs]/item:size-6 group-data-[size=xs]/item:rounded-md [&_img]:size-full [&_img]:object-cover",
      },
    },
  },
);

type ItemMediaProps = React.ComponentProps<"div"> & VariantProps<typeof itemMediaVariants>;

function ItemMedia({ className, variant = "default", ...props }: ItemMediaProps) {
  return (
    <div
      className={cn(itemMediaVariants({ className, variant }))}
      data-slot="item-media"
      data-variant={variant}
      {...props}
    />
  );
}

function ItemContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col gap-1 self-start group-data-[size=xs]/item:gap-0.5 [&+[data-slot=item-content]]:flex-none",
        className,
      )}
      data-slot="item-content"
      {...props}
    />
  );
}

function ItemTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "line-clamp-1 flex w-fit items-center gap-2 text-sm leading-snug font-medium underline-offset-4",
        className,
      )}
      data-slot="item-title"
      {...props}
    />
  );
}

function ItemDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-muted-foreground [&>a:hover]:text-primary line-clamp-2 text-left text-sm font-normal [&>a]:underline [&>a]:underline-offset-4",
        className,
      )}
      data-slot="item-description"
      {...props}
    />
  );
}

function ItemActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex items-center gap-2", className)} data-slot="item-actions" {...props} />
  );
}

function ItemHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex basis-full items-center justify-between gap-2", className)}
      data-slot="item-header"
      {...props}
    />
  );
}

function ItemFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex basis-full items-center justify-between gap-2", className)}
      data-slot="item-footer"
      {...props}
    />
  );
}

export {
  Item,
  ItemMedia,
  ItemContent,
  ItemActions,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
  ItemDescription,
  ItemHeader,
  ItemFooter,
  type ItemProps,
  type ItemGroupProps,
  type ItemMediaProps,
};
