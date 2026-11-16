import { cn } from "@zoonk/ui/lib/utils";
import { type VariantProps } from "class-variance-authority";
import { buttonVariants } from "./button";

/**
 * A button that opens the file picker: the browser's own picker is drawn its own way on every
 * system, so the input hides inside a label drawn as a `Button`, and its keyboard focus shows on it.
 */
function FileButton({
  children,
  className,
  size,
  variant = "outline",
  ...props
}: Omit<React.ComponentProps<"input">, "size" | "type"> &
  Pick<VariantProps<typeof buttonVariants>, "size" | "variant">) {
  return (
    <label
      className={cn(
        buttonVariants({ size, variant }),
        "has-focus-visible:border-ring has-focus-visible:ring-ring/50 cursor-pointer has-focus-visible:ring-[3px]",
        className,
      )}
      data-slot="file-button"
    >
      {children}
      <input className="sr-only" type="file" {...props} />
    </label>
  );
}

export { FileButton };
