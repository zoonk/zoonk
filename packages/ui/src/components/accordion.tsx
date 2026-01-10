"use client";

import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { cn } from "@zoonk/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

const accordionVariants = cva("flex w-full flex-col overflow-hidden", {
  defaultVariants: {
    variant: "default",
  },
  variants: {
    variant: {
      default: "rounded-2xl border",
      ghost: "rounded-none border-0",
    },
  },
});

const accordionItemVariants = cva("data-open:bg-muted/50", {
  defaultVariants: {
    variant: "default",
  },
  variants: {
    variant: {
      default: "not-last:border-b",
      ghost: "border-b-0 data-open:bg-transparent",
    },
  },
});

function Accordion({
  className,
  variant,
  ...props
}: AccordionPrimitive.Root.Props & VariantProps<typeof accordionVariants>) {
  return (
    <AccordionPrimitive.Root
      className={cn(accordionVariants({ className, variant }))}
      data-slot="accordion"
      {...props}
    />
  );
}

function AccordionItem({
  className,
  variant,
  ...props
}: AccordionPrimitive.Item.Props & VariantProps<typeof accordionItemVariants>) {
  return (
    <AccordionPrimitive.Item
      className={cn(accordionItemVariants({ className, variant }))}
      data-slot="accordion-item"
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  ...props
}: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          "group/accordion-trigger relative flex flex-1 items-start justify-between gap-6 border border-transparent p-4 text-left font-medium text-sm outline-none transition-all hover:underline disabled:pointer-events-none disabled:opacity-50 **:data-[slot=accordion-trigger-icon]:ml-auto **:data-[slot=accordion-trigger-icon]:size-4 **:data-[slot=accordion-trigger-icon]:text-muted-foreground",
          className,
        )}
        data-slot="accordion-trigger"
        {...props}
      >
        {children}
        <ChevronDownIcon
          className="pointer-events-none shrink-0 group-aria-expanded/accordion-trigger:hidden"
          data-slot="accordion-trigger-icon"
        />
        <ChevronUpIcon
          className="pointer-events-none hidden shrink-0 group-aria-expanded/accordion-trigger:inline"
          data-slot="accordion-trigger-icon"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({
  className,
  children,
  ...props
}: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      className="overflow-hidden px-4 text-sm data-closed:animate-accordion-up data-open:animate-accordion-down"
      data-slot="accordion-content"
      {...props}
    >
      <div
        className={cn(
          "h-(--accordion-panel-height) pt-0 pb-4 data-ending-style:h-0 data-starting-style:h-0 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
          className,
        )}
      >
        {children}
      </div>
    </AccordionPrimitive.Panel>
  );
}

export {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  accordionItemVariants,
  accordionVariants,
};
