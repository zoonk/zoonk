"use client";

import { Button } from "@zoonk/ui/components/button";
import { useIsMounted } from "@zoonk/ui/hooks/is-mounted";
import { RotateCcwIcon } from "lucide-react";
import { useState } from "react";
import { Specimen } from "./doc";

/**
 * A live specimen that plays its motion once it's on the page, and again with Replay. It draws its
 * example in the browser, as the moment the learner's action opens: a celebration never plays on
 * a page the server drew (`useCelebration`).
 */
export function MotionSpecimen({ children }: React.PropsWithChildren) {
  const mounted = useIsMounted();
  const [run, setRun] = useState(0);

  return (
    <Specimen className="flex items-start justify-between gap-6">
      <div className="min-w-0 flex-1" key={run}>
        {mounted && children}
      </div>

      <Button onClick={() => setRun((count) => count + 1)} size="sm" variant="outline">
        <RotateCcwIcon aria-hidden="true" />
        Replay
      </Button>
    </Specimen>
  );
}
