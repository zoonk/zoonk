"use client";

import { Button } from "@zoonk/ui/components/button";
import { RotateCcwIcon } from "lucide-react";
import { Suspense, use, useState } from "react";
import { browser } from "react-dom";
import { Specimen } from "./doc";

function InBrowser({ children }: React.PropsWithChildren) {
  use(browser());
  return children;
}

/**
 * A celebration never plays on a page the server drew (`useCelebration`), so the example draws in
 * the browser.
 */
export function MotionSpecimen({ children }: React.PropsWithChildren) {
  const [run, setRun] = useState(0);

  return (
    <Specimen className="flex items-start justify-between gap-6">
      <div className="min-w-0 flex-1" key={run}>
        <Suspense>
          <InBrowser>{children}</InBrowser>
        </Suspense>
      </div>

      <Button onClick={() => setRun((count) => count + 1)} size="sm" variant="outline">
        <RotateCcwIcon aria-hidden="true" />
        Replay
      </Button>
    </Specimen>
  );
}
