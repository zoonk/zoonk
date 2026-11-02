"use client";

import { Button } from "@zoonk/ui/components/button";
import { BookOpenIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { COLUMN_GHOST_ACTION_CLASS } from "../../components/step-layouts";
import { focusLessonAfterTurn } from "../_utils/lesson-focus";
import { useLessonPlayer } from "../lesson-player-context";

export function ExplainFirstButton() {
  const t = useExtracted();
  const { actions, screen } = useLessonPlayer();

  if (!screen.canExplainFirst) {
    return null;
  }

  return (
    <Button
      className={COLUMN_GHOST_ACTION_CLASS}
      onClick={() => {
        actions.explainFirst();
        focusLessonAfterTurn();
      }}
      size="sm"
      variant="ghost"
    >
      <BookOpenIcon aria-hidden="true" />
      {t({
        description:
          "Button the learner taps to see the lesson's explanation before answering this question.",
        message: "Explain first",
      })}
    </Button>
  );
}
