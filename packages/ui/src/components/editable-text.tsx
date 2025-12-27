import { cn } from "@zoonk/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const editableTextVariants = cva(
  [
    "w-full border-none bg-transparent px-0 outline-none",
    "cursor-text placeholder:text-muted-foreground/50",
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
        description:
          "text-pretty text-muted-foreground leading-tight tracking-tight",
        muted: "text-muted-foreground",
        title:
          "scroll-m-20 text-balance font-semibold text-foreground/90 text-lg leading-none tracking-tight",
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
    "cursor-text placeholder:text-muted-foreground/50",
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
        description:
          "text-pretty text-muted-foreground leading-tight tracking-tight",
        muted: "text-muted-foreground",
      },
    },
  },
);

export type EditableTextareaProps = React.ComponentProps<"textarea"> &
  VariantProps<typeof editableTextareaVariants>;

function EditableTextarea({
  className,
  variant,
  rows = 1,
  ...props
}: EditableTextareaProps) {
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
  EditableText,
  editableTextVariants,
  EditableTextarea,
  editableTextareaVariants,
};
