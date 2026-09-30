"use client";

import { MovedScreen } from "../_components/moved-screen";
import { useMockScreen } from "./mock-context";
import { MockStepStatus } from "./mock-frame";

/** After "Move to Monday": the mock's new day, with an undo. */
export function MockMoved() {
  const { hrefs, buddy, runner } = useMockScreen();

  if (!runner.moved) {
    return null;
  }

  return (
    <MovedScreen
      date={runner.moved.date}
      error={<MockStepStatus />}
      exitHref={hrefs.exit}
      onUndo={runner.moved.changeId ? () => void runner.undoMove() : null}
      pending={runner.pending}
      buddy={buddy}
    />
  );
}
