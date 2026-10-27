"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useState } from "react";

const SEGMENTS = 5;

/** The demo's answers, right or wrong in turn, as a task's header colors them. */
function segmentClass(index: number, answered: number): string {
  if (index >= answered) {
    return "bg-surface-3";
  }

  return index === 2 ? "bg-destructive" : "bg-success";
}

/** A button and a wide option giving way while held. */
export function PressDemo() {
  return (
    <div className="flex flex-col items-start gap-4">
      <button
        className="press bg-primary text-primary-foreground hover:bg-primary/80 h-11 rounded-lg px-5 text-[0.9375rem] font-medium"
        type="button"
      >
        Continue
      </button>

      <button
        className="press ring-input hover:bg-muted rounded-option flex min-h-12 w-full max-w-sm items-center gap-3 px-4 text-left text-sm ring-1 [--press-scale:0.99]"
        type="button"
      >
        <span className="text-muted-foreground font-mono">1</span>
        Press and hold this wide option
      </button>
    </div>
  );
}

/** A task's header: each answer turns its segment blue or pink-red, in the quick time. */
export function StateDemo() {
  const [answered, setAnswered] = useState(0);
  const done = answered === SEGMENTS;

  return (
    <div className="flex max-w-sm flex-col items-start gap-4">
      <div aria-hidden="true" className="flex h-1 w-full gap-0.5">
        {Array.from({ length: SEGMENTS }, (_, index) => (
          <span
            className={cn("flex-1 rounded-xs transition-colors", segmentClass(index, answered))}
            // oxlint-disable-next-line react/no-array-index-key -- Segments are the task's questions.
            key={index}
          />
        ))}
      </div>

      <Button onClick={() => setAnswered(done ? 0 : answered + 1)} size="sm" variant="outline">
        {done ? "Start over" : "Answer"}
      </Button>
    </div>
  );
}
