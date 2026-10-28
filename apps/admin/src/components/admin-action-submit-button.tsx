"use client";

import { Button } from "@zoonk/ui/components/button";
import { Loader2Icon } from "lucide-react";
import { useFormStatus } from "react-dom";

export function AdminActionSubmitButton({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  const status = useFormStatus();

  return (
    <Button disabled={status.pending} size="sm" type="submit" variant="outline">
      {status.pending ? <Loader2Icon className="animate-spin" /> : icon}
      {children}
    </Button>
  );
}
