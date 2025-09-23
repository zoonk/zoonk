"use client";

import { Loader2Icon } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "./ui/button";

interface SubmitButtonProps {
  children: React.ReactNode;
}

export default function SubmitButton({ children }: SubmitButtonProps) {
  const status = useFormStatus();

  return (
    <Button type="submit" disabled={status.pending} className="w-full">
      {status.pending && <Loader2Icon className="animate-spin" />}
      {children}
    </Button>
  );
}
