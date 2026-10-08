"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { KindTile } from "../_components/kind-tile";
import {
  ListRow,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { PracticeOutcomeMessage } from "../_components/practice-outcome-message";
import { usePracticeRun } from "../_utils/use-practice-run";
import { useChapterScreen } from "./chapter-context";

/**
 * The chapter's open mistakes as a row of its "Practice" list, only when there are some, with
 * "Practice now" on its skills.
 */
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
      <ListRow>
        <ListRowLeading>
          <KindTile kind="mistakes" />
        </ListRowLeading>
        <ListRowContent>
          <ListRowTitle>{t("Mistakes notebook")}</ListRowTitle>
          <ListRowDescription>
            {t("{count, plural, one {# from this chapter} other {# from this chapter}}", {
              count: open,
            })}
          </ListRowDescription>
        </ListRowContent>
        <ListRowTrailing>
          <Button disabled={isPending} onClick={practice} size="sm" variant="outline">
            {t("Practice now")}
          </Button>
        </ListRowTrailing>
      </ListRow>

      <div className="px-4 empty:hidden [&:has(>*)]:pb-3">
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
