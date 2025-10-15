"use client";

import { Button } from "@zoonk/ui/components/button";
import { Loader2Icon } from "lucide-react";
import { useFormStatus } from "react-dom";

interface SubmitButtonProps extends React.ComponentProps<"button"> {
  full?: boolean;
}

export function SubmitButton({ children, full }: SubmitButtonProps) {
  const status = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={status.pending}
      className={full ? "w-full" : "w-max"}
    >
      {status.pending && <Loader2Icon className="animate-spin" />}
      {children}
    </Button>
  );
}
