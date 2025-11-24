import { cn } from "@zoonk/ui/lib/utils";
import type * as React from "react";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        "lg:max-w-lg",
        className,
      )}
      data-slot="input"
      type={type}
      {...props}
    />
  );
}

interface InputErrorProps extends React.ComponentProps<"p"> {
  kind?: "assertive" | "polite";
}

function InputError({ className, kind = "polite", ...props }: InputErrorProps) {
  return (
    <p
      aria-atomic={true}
      aria-live={kind}
      className={cn("text-destructive text-sm", className)}
      {...props}
    />
  );
}

interface InputSuccessProps extends React.ComponentProps<"p"> {
  kind?: "assertive" | "polite";
}

function InputSuccess({
  className,
  kind = "polite",
  ...props
}: InputSuccessProps) {
  return (
    <p
      aria-atomic={true}
      aria-live={kind}
      className={cn("text-green-600 text-sm", className)}
      {...props}
    />
  );
}

export { Input, InputError, InputSuccess };
