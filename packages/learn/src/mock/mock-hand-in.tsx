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
import { useSentenceSpace } from "../_utils/locale";
import { useMockScreen } from "./mock-context";
import { useSectionCounts } from "./mock-section-counts";

function useQuestionsLeftOpen(): string {
  const t = useExtracted();
  const { blank, essays, flagged, total } = useSectionCounts();

  if (blank > 0 && flagged > 0) {
    return t({
      description: "Before handing in a mock exam: how many of its questions are blank or flagged.",
      message:
        "{blank, plural, one {# question is blank} other {# questions are blank}} and {flagged, plural, one {# is marked for review} other {# are marked for review}}.",
      values: { blank, flagged },
    });
  }

  if (blank > 0) {
    return t({
      description: "Before handing in a mock exam: how many of its questions are blank or flagged.",
      message: "{count, plural, one {# question is blank.} other {# questions are blank.}}",
      values: { count: blank },
    });
  }

  if (flagged > 0) {
    return t({
      description: "Before handing in a mock exam: how many of its questions are blank or flagged.",
      message:
        "{count, plural, one {# question is marked for review.} other {# questions are marked for review.}}",
      values: { count: flagged },
    });
  }

  return total > essays ? t("Every question is answered.") : "";
}

function useLeftOpen(): string {
  const t = useExtracted();
  const { blankEssays } = useSectionCounts();
  const questions = useQuestionsLeftOpen();
  const space = useSentenceSpace();

  const essays =
    blankEssays > 0
      ? t("{count, plural, one {The essay is blank.} other {# essays are blank.}}", {
          count: blankEssays,
        })
      : "";

  return [questions, essays].filter(Boolean).join(space);
}

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
  const space = useSentenceSpace();

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isLast ? t("Hand in the mock exam?") : t("Hand in this section?")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {leftOpen}
            {space}
            {t("After this, your answers can't change.")}
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
