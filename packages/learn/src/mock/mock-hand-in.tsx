"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@zoonk/ui/components/alert-dialog";
import { useExtracted } from "next-intl";
import { useMockScreen } from "./mock-context";
import { useSectionCounts } from "./mock-section-counts";

/** What's still open in the section: blank and flagged questions, or that every one is answered. */
function useQuestionsLeftOpen(): string {
  const t = useExtracted();
  const { blank, essays, flagged, total } = useSectionCounts();

  if (blank > 0 && flagged > 0) {
    return t(
      "{blank, plural, one {# question is blank} other {# questions are blank}} and {flagged, plural, one {# is flagged} other {# are flagged}}.",
      { blank, flagged },
    );
  }

  if (blank > 0) {
    return t("{count, plural, one {# question is blank.} other {# questions are blank.}}", {
      count: blank,
    });
  }

  if (flagged > 0) {
    return t("{count, plural, one {# question is flagged.} other {# questions are flagged.}}", {
      count: flagged,
    });
  }

  // A written part on its own has no questions to count.
  return total > essays ? t("Every question is answered.") : "";
}

/** What's still open, an essay left blank (a full mock's written part) said apart. */
function useLeftOpen(): string {
  const t = useExtracted();
  const { blankEssays } = useSectionCounts();
  const questions = useQuestionsLeftOpen();

  const essays =
    blankEssays > 0
      ? t("{count, plural, one {The essay is blank.} other {# essays are blank.}}", {
          count: blankEssays,
        })
      : "";

  return [questions, essays].filter(Boolean).join(" ");
}

/**
 * Handing a section in can't be undone, so it's confirmed first with what's still open. The clock
 * running out closes the answers and shows a direct hand-in action.
 */
export function MockHandInDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const isLast = runner.view.sections.at(-1)?.status === "current";
  const leftOpen = useLeftOpen();

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isLast ? t("Hand in the mock exam?") : t("Hand in this section?")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {leftOpen} {t("After this, your answers can't change.")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("Keep answering")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onOpenChange(false);
              void runner.submitSection();
            }}
          >
            {t("Hand in")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
