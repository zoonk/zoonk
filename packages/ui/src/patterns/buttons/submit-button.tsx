"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { Loader2Icon } from "lucide-react";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  icon,
  className,
  full,
  ...props
}: {
  icon?: React.ReactNode;
  full?: boolean;
} & React.ComponentProps<"button">) {
  const status = useFormStatus();

  return (
    <Button
      className={cn({
        className,
        "w-full": full,
        "w-max": !full,
      })}
      disabled={status.pending}
      type="submit"
      {...props}
    >
      {!status.pending && icon}
      {status.pending && <Loader2Icon className="animate-spin" />}
      {children}
    </Button>
  );
}
