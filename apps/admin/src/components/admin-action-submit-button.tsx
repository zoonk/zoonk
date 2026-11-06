"use client";

import { Button } from "@zoonk/ui/components/button";
import { useFormStatus } from "react-dom";

export function AdminActionSubmitButton({
  children,
  icon,
  size = "sm",
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  size?: "lg" | "sm";
}) {
  const status = useFormStatus();

  return (
    <Button busy={status.pending} size={size} type="submit" variant="outline">
      {icon}
      {children}
    </Button>
  );
}
