"use client";

import { Slot } from "@radix-ui/react-slot";
import { cn } from "@zoonk/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Ellipsis } from "lucide-react";
import type * as React from "react";
import { useScrollDirection } from "../hooks/use-scroll-direction";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

type TabBarProps = React.ComponentProps<"div"> & {
  /** Right action element (e.g., search, close button) */
  action?: React.ReactNode;
};

function TabBar({ children, action, className, ...props }: TabBarProps) {
  const { scrollDirection, isAtTop } = useScrollDirection({ threshold: 10 });
  const isVisible = scrollDirection === "up" || isAtTop;

  return (
    <div
      aria-hidden={!isVisible}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] transition-transform duration-300 ease-out",
        isVisible ? "translate-y-0" : "translate-y-full",
        className,
      )}
      data-slot="tab-bar"
      {...props}
    >
      <nav className="flex items-center gap-1 rounded-full border border-border bg-background/80 p-1.5 shadow-lg backdrop-blur-md">
        {children}
      </nav>

      {action && (
        <div className="flex items-center rounded-full border border-border bg-background/80 p-1.5 shadow-lg backdrop-blur-md">
          {action}
        </div>
      )}
    </div>
  );
}

const tabBarItemVariants = cva(
  "inline-flex size-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium text-sm outline-none transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    defaultVariants: {
      active: false,
    },
    variants: {
      active: {
        false: "hover:bg-accent hover:text-accent-foreground",
        true: "bg-primary-foreground text-primary dark:bg-primary dark:text-primary-foreground",
      },
    },
  },
);

type TabBarItemProps = React.ComponentProps<"a"> &
  VariantProps<typeof tabBarItemVariants> & {
    asChild?: boolean;
  };

function TabBarItem({
  asChild = false,
  active = false,
  className,
  ...props
}: TabBarItemProps) {
  const Comp = asChild ? Slot : "a";

  return (
    <Comp
      aria-current={active ? "page" : undefined}
      className={cn(tabBarItemVariants({ active, className }))}
      data-active={active}
      data-slot="tab-bar-item"
      {...props}
    />
  );
}

function TabBarOverflow({ children }: React.ComponentProps<"div">) {
  return <DropdownMenu>{children}</DropdownMenu>;
}

type TabBarOverflowTriggerProps = {
  active?: boolean;
  moreLabel: string;
};

function TabBarOverflowTrigger({
  active = false,
  moreLabel,
}: TabBarOverflowTriggerProps) {
  return (
    <DropdownMenuTrigger
      className={cn(tabBarItemVariants({ active }))}
      data-slot="tab-bar-overflow-trigger"
    >
      <Ellipsis aria-hidden="true" />
      <span className="sr-only">{moreLabel}</span>
    </DropdownMenuTrigger>
  );
}

type TabBarOverflowMenuProps = React.ComponentProps<typeof DropdownMenuContent>;

function TabBarOverflowMenu({
  children,
  align = "end",
  side = "top",
  ...props
}: TabBarOverflowMenuProps) {
  return (
    <DropdownMenuContent
      align={align}
      data-slot="tab-bar-overflow-menu"
      side={side}
      {...props}
    >
      {children}
    </DropdownMenuContent>
  );
}

type TabBarOverflowItemProps = React.ComponentProps<typeof DropdownMenuItem> & {
  asChild?: boolean;
};

function TabBarOverflowItem({
  asChild = true,
  ...props
}: TabBarOverflowItemProps) {
  return (
    <DropdownMenuItem
      asChild={asChild}
      data-slot="tab-bar-overflow-item"
      {...props}
    />
  );
}

type TabBarActionProps = React.ComponentProps<"a"> & {
  asChild?: boolean;
};

function TabBarAction({
  asChild = false,
  className,
  ...props
}: TabBarActionProps) {
  const Comp = asChild ? Slot : "a";

  return (
    <Comp
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium text-sm outline-none transition-all hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      data-slot="tab-bar-action"
      {...props}
    />
  );
}

export {
  TabBar,
  TabBarItem,
  tabBarItemVariants,
  TabBarOverflow,
  TabBarOverflowTrigger,
  TabBarOverflowMenu,
  TabBarOverflowItem,
  TabBarAction,
};
