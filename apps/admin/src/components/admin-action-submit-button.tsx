"use client";

import { Button } from "@zoonk/ui/components/button";
import { useFormStatus } from "react-dom";

/** A form's one-press action. `ghost` is for the quieter of two actions on a row. */
export function AdminActionSubmitButton({
  children,
  icon,
  size = "sm",
  variant = "outline",
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  size?: "bar" | "lg" | "sm";
  variant?: "ghost" | "outline";
}) {
  const status = useFormStatus();

  return (
    <Button busy={status.pending} icon={icon} size={size} type="submit" variant={variant}>
      {children}
    </Button>
  );
}
