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
import { useState } from "react";
import { useFormatDuration } from "../_utils/time-format";
import { type MockShortStatus } from "./mock-chooser-parts";

function useShortLine() {
  const t = useExtracted();
  const duration = useFormatDuration();

  return ({ examQuestions, limit, minutes, questions }: MockShortStatus): string => {
    const values = { count: questions, time: duration(minutes), total: examQuestions };

    if (limit === "day") {
      return t(
        "Today this one has {count, number} of its {total, number} questions, about {time}. You can take the full one tomorrow.",
        values,
      );
    }

    if (limit === "month") {
      return t(
        "Today this one has {count, number} of its {total, number} questions, about {time}. You can take the full one next month.",
        values,
      );
    }

    return t(
      "Today this one has {count, number} of its {total, number} questions, about {time}.",
      values,
    );
  };
}

/** A mock exam shorter than the one picked never starts unannounced: the learner agrees first. */
export function MockShortDialog({
  onCancel,
  onStart,
  status,
}: {
  onCancel: () => void;
  onStart: () => void;
  status: MockShortStatus | null;
}) {
  const t = useExtracted();
  const line = useShortLine();
  const [last, setLast] = useState(status);

  // The words stay while the dialog closes.
  if (status && status !== last) {
    setLast(status);
  }

  return (
    <AlertDialog onOpenChange={(open) => !open && onCancel()} open={status !== null}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Start a shorter mock exam?")}</AlertDialogTitle>
          <AlertDialogDescription>{last && line(last)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("Pick another")}</AlertDialogCancel>
          <AlertDialogAction onClick={onStart}>{t("Start")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
