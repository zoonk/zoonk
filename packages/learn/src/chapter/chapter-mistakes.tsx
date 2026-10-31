"use client";

import { useExtracted } from "next-intl";
import { KindDot } from "../_components/kind-tile";
import {
  ListRowButton,
  ListRowContent,
  ListRowLeading,
  ListRowTitle,
} from "../_components/list-group";
import { PracticeOutcomeMessage } from "../_components/practice-outcome-message";
import { usePracticeRun } from "../_utils/use-practice-run";
import { useChapterScreen } from "./chapter-context";

export function ChapterMistakes() {
  const t = useExtracted();
  const { actions, chapter } = useChapterScreen();
  const { isPending, outcome, practice } = usePracticeRun(actions.practice);
  const { open } = chapter.mistakes;

  if (open === 0) {
    return null;
  }

  return (
    <>
      <ListRowButton disabled={isPending} onClick={practice}>
        <ListRowLeading>
          <KindDot kind="practice" />
        </ListRowLeading>
        <ListRowContent>
          <ListRowTitle>{t("Practice this chapter")}</ListRowTitle>
        </ListRowContent>
      </ListRowButton>

      <div className="empty:hidden in-data-[list=panel]:px-4 [&:has(>*)]:pb-3">
        <PracticeOutcomeMessage
          dailyCap={t(
            "That's all the bonus practice for today. Tomorrow's session picks this chapter up.",
          )}
          nothingToPractice={t("Nothing to practice in this chapter yet.")}
          outcome={outcome}
        />
      </div>
    </>
  );
}
