"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { Loader2Icon } from "lucide-react";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  className,
  disabled,
  full,
  icon,
  ...props
}: { icon?: React.ReactNode; full?: boolean } & React.ComponentProps<"button">) {
  const status = useFormStatus();

  return (
    <Button
      className={cn(full ? "w-full" : "w-max", className)}
      disabled={status.pending || disabled}
      type="submit"
      {...props}
    >
      {!status.pending && icon}
      {status.pending && <Loader2Icon className="animate-spin" />}
      {children}
    </Button>
  );
}
