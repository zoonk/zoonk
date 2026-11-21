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
  const { blank, essays, total, unsure } = useSectionCounts();

  if (blank > 0 && unsure > 0) {
    return t({
      description:
        'Before handing in a mock exam: how many of its questions are blank, or marked with the "Not sure" button.',
      message:
        "{blank, plural, one {# question is blank} other {# questions are blank}} and you're not sure of {unsure, plural, one {#} other {#}}.",
      values: { blank, unsure },
    });
  }

  if (blank > 0) {
    return t({
      description: "Before handing in a mock exam: how many of its questions are blank.",
      message: "{count, plural, one {# question is blank.} other {# questions are blank.}}",
      values: { count: blank },
    });
  }

  if (unsure > 0) {
    return t({
      description:
        'Before handing in a mock exam: how many of its questions are blank, or marked with the "Not sure" button.',
      message:
        "{count, plural, one {You're not sure of # answer.} other {You're not sure of # answers.}}",
      values: { count: unsure },
    });
  }

  return total > essays ? t("Every question is answered.") : "";
}

/** A whole written answer is a question: "written" tells it apart only beside objective ones. */
function useBlankWritten(): string {
  const t = useExtracted();
  const { blankEssays, essays, total } = useSectionCounts();

  if (blankEssays === 0) {
    return "";
  }

  if (essays === total) {
    return t({
      description: "Before handing in a mock exam: how many of its questions are blank or flagged.",
      message: "{count, plural, one {# question is blank.} other {# questions are blank.}}",
      values: { count: blankEssays },
    });
  }

  return t({
    description:
      "Before handing in a mock exam with objective and written questions: how many written answers are blank.",
    message:
      "{count, plural, one {The written question is blank.} other {# written questions are blank.}}",
    values: { count: blankEssays },
  });
}

function useLeftOpen(): string {
  const questions = useQuestionsLeftOpen();
  const written = useBlankWritten();
  const space = useSentenceSpace();

  return [questions, written].filter(Boolean).join(space);
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
