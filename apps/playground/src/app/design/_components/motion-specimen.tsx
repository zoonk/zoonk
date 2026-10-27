"use client";

import { Button } from "@zoonk/ui/components/button";
import { RotateCcwIcon } from "lucide-react";
import { useState } from "react";
import { Specimen } from "../../_components/doc";

/** A live specimen that plays its motion once on mount, and again with Replay. */
export function MotionSpecimen({ children }: React.PropsWithChildren) {
  const [run, setRun] = useState(0);

  return (
    <Specimen className="flex items-start justify-between gap-6">
      <div className="min-w-0 flex-1" key={run}>
        {children}
      </div>

      <Button onClick={() => setRun((count) => count + 1)} size="sm" variant="outline">
        <RotateCcwIcon aria-hidden="true" />
        Replay
      </Button>
    </Specimen>
  );
}
