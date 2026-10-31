"use client";

import { Button } from "@zoonk/ui/components/button";
import { Loader2Icon } from "lucide-react";
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
    <Button disabled={status.pending} size={size} type="submit" variant="outline">
      {status.pending ? <Loader2Icon className="animate-spin" /> : icon}
      {children}
    </Button>
  );
}
