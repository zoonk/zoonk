"use client";

import { Button, FORWARD_ICON } from "@zoonk/ui/components/button";
import { InputError } from "@zoonk/ui/components/input";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { cn } from "@zoonk/ui/lib/utils";
import { useFormStatus } from "react-dom";

/** What the log in, code and profile setup screens share: a centered title, a field, its error and Continue. */
export function AuthHeader({ children, className }: React.ComponentProps<"header">) {
  return (
    <header className={cn("flex flex-col items-center gap-2 text-center", className)}>
      {children}
    </header>
  );
}

export function AuthTitle({ children, className }: React.ComponentProps<"h1">) {
  return (
    <h1
      className={cn(
        "text-2xl leading-[1.1] font-[620] tracking-[-0.035em] text-balance sm:text-3xl",
        className,
      )}
    >
      {children}
    </h1>
  );
}

export function AuthDescription({ children, className, ...props }: React.ComponentProps<"p">) {
  return (
    <p className={cn("text-muted-foreground text-sm text-balance", className)} {...props}>
      {children}
    </p>
  );
}

export function AuthForm({ children, className, ...props }: React.ComponentProps<"form">) {
  return (
    <form className={cn("flex w-full flex-col gap-2", className)} {...props}>
      {children}
    </form>
  );
}

export function AuthField({ children, className }: React.ComponentProps<"fieldset">) {
  return <fieldset className={cn("grid gap-3", className)}>{children}</fieldset>;
}

/**
 * The one line between a form's field and Continue that says what went wrong, or that something was
 * done. Its room is always there, so Continue doesn't move when it fills.
 */
export function AuthStatus({
  children,
  className,
  tone = "error",
  ...props
}: React.ComponentProps<"p"> & { tone?: "error" | "quiet" }) {
  return (
    <InputError
      aria-live="polite"
      className={cn("min-h-5", tone === "quiet" && "text-muted-foreground", className)}
      {...props}
    >
      {children}
    </InputError>
  );
}

export function AuthSubmit({
  children,
  className,
  isLoading,
  ...props
}: React.ComponentProps<typeof Button> & { isLoading?: boolean }) {
  const status = useFormStatus();

  return (
    <Button
      aria-keyshortcuts="Enter"
      busy={isLoading ?? status.pending}
      className={cn("w-full", className)}
      focusableWhenDisabled
      size="lg"
      type="submit"
      {...FORWARD_ICON}
      {...props}
    >
      {children}
      <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
    </Button>
  );
}
