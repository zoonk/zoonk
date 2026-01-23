import { cn } from "@zoonk/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";

export type EditableLabelProps = React.ComponentProps<"label"> & {
  icon?: LucideIcon;
};

function EditableLabel({ children, className, icon: Icon, ...props }: EditableLabelProps) {
  return (
    <label
      className={cn("text-muted-foreground flex items-center gap-1.5 text-xs", className)}
      {...props}
    >
      {Icon && <Icon aria-hidden="true" className="size-3" />}
      {children}
    </label>
  );
}

const editableTextVariants = cva(
  [
    "w-full border-none bg-transparent px-0 outline-none",
    "placeholder:text-muted-foreground/50 cursor-text",
    "focus-visible:ring-0",
    "transition-colors duration-150",
  ],
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default: "text-foreground",
        description: "text-muted-foreground leading-tight tracking-tight text-pretty",
        muted: "text-muted-foreground",
        title:
          "text-foreground/90 scroll-m-20 text-lg leading-none font-semibold tracking-tight text-balance",
      },
    },
  },
);

export type EditableTextProps = Omit<React.ComponentProps<"input">, "type"> &
  VariantProps<typeof editableTextVariants>;

function EditableText({ className, variant, ...props }: EditableTextProps) {
  return (
    <input
      className={cn(editableTextVariants({ variant }), className)}
      data-slot="editable-text"
      type="text"
      {...props}
    />
  );
}

const editableTextareaVariants = cva(
  [
    "w-full border-none bg-transparent px-0 outline-none",
    "field-sizing-content min-h-6 resize-none",
    "placeholder:text-muted-foreground/50 cursor-text",
    "focus-visible:ring-0",
    "transition-colors duration-150",
  ],
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default: "text-foreground",
        description: "text-muted-foreground leading-tight tracking-tight text-pretty",
        muted: "text-muted-foreground",
      },
    },
  },
);

export type EditableTextareaProps = React.ComponentProps<"textarea"> &
  VariantProps<typeof editableTextareaVariants>;

function EditableTextarea({ className, variant, rows = 1, ...props }: EditableTextareaProps) {
  return (
    <textarea
      className={cn(editableTextareaVariants({ variant }), className)}
      data-slot="editable-textarea"
      rows={rows}
      {...props}
    />
  );
}

export {
  EditableLabel,
  EditableText,
  editableTextVariants,
  EditableTextarea,
  editableTextareaVariants,
};
