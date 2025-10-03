"use client";

import { Loader2Icon } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "./ui/button";

interface SubmitButtonProps {
  children: React.ReactNode;
  full?: boolean;
}

export default function SubmitButton({ children, full }: SubmitButtonProps) {
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
