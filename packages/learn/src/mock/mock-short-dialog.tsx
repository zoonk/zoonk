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
import { useOpeningDay } from "../_components/comes-back-words";
import { useFormatIsoDate } from "../_utils/iso-date";
import { type OpeningDay } from "../_utils/opening-day";
import { useFormatDuration } from "../_utils/time-format";
import { type MockShortStatus } from "./mock-chooser-parts";

function useShortLine() {
  const t = useExtracted();
  const duration = useFormatDuration();
  const formatDate = useFormatIsoDate();

  return (
    { examQuestions, limit, minutes, questions }: MockShortStatus,
    opensOn: OpeningDay | null,
  ): string => {
    const values = { count: questions, time: duration(minutes), total: examQuestions };
    const fullOn = limit === "rolling30Days" ? opensOn : null;

    if (limit === "day" || fullOn === "tomorrow") {
      return t(
        "Today this one has {count, number} of its {total, number} questions, about {time}. You can take the full one tomorrow.",
        values,
      );
    }

    if (fullOn === "today") {
      return t({
        description:
          "In a dialog before a mock exam starts shorter than the one picked, because the learner used the questions they can have written for now.",
        message:
          "Today this one has {count, number} of its {total, number} questions, about {time}. You can take the full one later today.",
        values,
      });
    }

    if (fullOn && fullOn !== "open") {
      return t({
        description:
          'In a dialog before a mock exam starts shorter than the one picked, because the learner used the questions they can have written for now. {date} is a day and its month, such as "November 22" in English.',
        message:
          "Today this one has {count, number} of its {total, number} questions, about {time}. You can take the full one on {date}.",
        values: { ...values, date: formatDate(fullOn, "long") },
      });
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
  const opensOn = useOpeningDay(last?.limit === "rolling30Days" ? last.availableAt : null);

  // The words stay while the dialog closes.
  if (status && status !== last) {
    setLast(status);
  }

  return (
    <AlertDialog onOpenChange={(open) => !open && onCancel()} open={status !== null}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Start a shorter mock exam?")}</AlertDialogTitle>
          <AlertDialogDescription>{last && line(last, opensOn)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("Pick another")}</AlertDialogCancel>
          <AlertDialogAction onClick={onStart}>{t("Start")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
