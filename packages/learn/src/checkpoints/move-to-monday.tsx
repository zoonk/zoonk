"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { MovedScreen } from "../_components/moved-screen";
import { useCheckpointScreen } from "./checkpoint-context";

function MoveFailed() {
  const t = useExtracted();
  const { move } = useCheckpointScreen();

  if (!move.failed) {
    return null;
  }

  return (
    <p className="text-destructive text-center text-sm" role="alert">
      {t("That didn't go through. Try again in a moment.")}
    </p>
  );
}

/** The quiet second option under "I'm in": the week's challenge can wait for Monday. */
export function MoveToMondayButton() {
  const t = useExtracted();
  const { duel, move } = useCheckpointScreen();

  if (!move.canMove) {
    return null;
  }

  return (
    <>
      <MoveFailed />
      <Button
        className="w-full"
        disabled={move.pending || duel.state.pending}
        onClick={() => void move.moveToMonday()}
        size="lg"
        variant="ghost"
      >
        {t("Move to Monday")}
      </Button>
    </>
  );
}

/** After "Move to Monday": the challenge's new day, with an undo. */
export function ChallengeMoved() {
  const { hrefs, move, buddy } = useCheckpointScreen();

  if (!move.moved) {
    return null;
  }

  return (
    <MovedScreen
      date={move.moved.date}
      error={<MoveFailed />}
      exitHref={hrefs.exit}
      onUndo={move.moved.changeId ? () => void move.undo() : null}
      pending={move.pending}
      buddy={buddy}
    />
  );
}
