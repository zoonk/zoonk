import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@zoonk/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";
import type * as React from "react";

const itemVariants = cva(
  "group/item focus-visible:border-ring focus-visible:ring-ring/50 [a]:hover:bg-muted flex w-full flex-wrap items-center rounded-xl border text-sm transition-colors duration-100 outline-none focus-visible:ring-[3px] [a]:transition-colors",
  {
    defaultVariants: { size: "default", variant: "default" },
    variants: {
      size: {
        default: "gap-3.5 px-4 py-3.5",
        sm: "gap-3.5 px-3.5 py-3",
        xs: "gap-2.5 px-3 py-2.5 in-data-[slot=dropdown-menu-content]:p-0",
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
    props: mergeProps<"div">({ className: cn(itemVariants({ className, size, variant })) }, props),
    render,
    state: { size, slot: "item", variant },
  });
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

export { Item, ItemContent, ItemActions, ItemTitle, ItemDescription };
