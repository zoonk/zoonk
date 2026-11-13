"use client";

import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { cn } from "@zoonk/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";
import { FoldChevron } from "./collapsible";

const accordionVariants = cva("flex w-full flex-col overflow-hidden", {
  defaultVariants: { variant: "default" },
  variants: { variant: { default: "rounded-xl border", ghost: "rounded-none border-0" } },
});

const accordionItemVariants = cva("data-open:bg-muted/50", {
  defaultVariants: { variant: "default" },
  variants: {
    variant: { default: "not-last:border-b", ghost: "border-b-0 data-open:bg-transparent" },
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

function AccordionTrigger({ className, children, ...props }: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          "focus-visible:ring-ring/50 relative flex flex-1 items-start justify-between gap-6 rounded-lg border border-transparent p-4 text-left text-sm font-medium transition-colors outline-none hover:underline focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50",
          className,
        )}
        data-slot="accordion-trigger"
        {...props}
      >
        {children}
        <FoldChevron />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({ className, children, ...props }: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      className="data-closed:animate-accordion-up data-open:animate-accordion-down overflow-hidden px-4 text-sm"
      data-slot="accordion-content"
      {...props}
    >
      <div
        className={cn(
          "[&_a]:hover:text-foreground h-(--accordion-panel-height) pt-0 pb-4 data-ending-style:h-0 data-starting-style:h-0 [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-4",
          className,
        )}
      >
        {children}
      </div>
    </AccordionPrimitive.Panel>
  );
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
