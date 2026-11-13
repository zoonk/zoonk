"use client";

import { Button } from "@zoonk/ui/components/button";
import { EnterButton } from "@zoonk/ui/components/enter-button";
import { cn } from "@zoonk/ui/lib/utils";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  className,
  full,
  ...props
}: { full?: boolean } & React.ComponentProps<typeof Button>) {
  const status = useFormStatus();

  return (
    <Button
      busy={status.pending}
      className={cn(full ? "w-full" : "w-max", className)}
      focusableWhenDisabled
      type="submit"
      {...props}
    />
  );
}

/**
 * A form that is its screen's main action: Enter in its fields submits it, so the button shows the
 * ⏎ keycap and is busy while the form is pending.
 */
export function MainSubmitButton({
  className,
  ...props
}: Omit<React.ComponentProps<typeof EnterButton>, "busy" | "enter" | "type">) {
  const status = useFormStatus();

  return (
    <EnterButton
      busy={status.pending}
      className={cn("w-full", className)}
      enter="host"
      type="submit"
      {...props}
    />
  );
}
