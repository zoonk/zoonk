"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  className,
  full,
  icon,
  ...props
}: { icon?: React.ReactNode; full?: boolean } & React.ComponentProps<typeof Button>) {
  const status = useFormStatus();

  return (
    <Button
      busy={status.pending}
      className={cn(full ? "w-full" : "w-max", className)}
      focusableWhenDisabled
      type="submit"
      {...props}
    >
      {icon}
      {children}
    </Button>
  );
}
