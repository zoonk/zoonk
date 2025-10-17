"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { Loader2Icon } from "lucide-react";
import { useFormStatus } from "react-dom";

interface SubmitButtonProps extends React.ComponentProps<"button"> {
  icon?: React.ReactNode;
  full?: boolean;
}

export function SubmitButton({
  children,
  icon,
  className,
  full,
  ...props
}: SubmitButtonProps) {
  const status = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={status.pending}
      className={cn({
        "w-full": full,
        "w-max": !full,
        className,
      })}
      {...props}
    >
      {!status.pending && icon}
      {status.pending && <Loader2Icon className="animate-spin" />}
      {children}
    </Button>
  );
}
