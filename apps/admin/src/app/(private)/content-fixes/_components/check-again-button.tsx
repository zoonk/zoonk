"use client";

import { Button } from "@zoonk/ui/components/button";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** Reads the page's data again, for a state the server finishes on its own, such as a clip. */
export function CheckAgainButton() {
  const router = useRouter();
  const [isChecking, startChecking] = useTransition();

  return (
    <Button
      busy={isChecking}
      onClick={() => startChecking(() => router.refresh())}
      size="sm"
      variant="outline"
    >
      Check again
    </Button>
  );
}
