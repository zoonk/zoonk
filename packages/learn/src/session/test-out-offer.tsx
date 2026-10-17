"use client";

import { Button } from "@zoonk/ui/components/button";
import { FastForwardIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  type TestOutStart,
  TestOutStartStatus,
  useTestOutStart,
} from "../_components/test-out-start-link";
import { type StudyMomentView } from "./session-types";

type TestOutOfferView = NonNullable<StudyMomentView["testOutOffer"]>;

/**
 * Right after the second lesson in a row of a chapter with every answer right, once: the chapter's
 * test, which skips the lessons a pass takes off the plan, as one hairline row with a small "Take
 * the test" on its right. Continue stays the moment's main action.
 */
export function TestOutOffer({
  offer,
  onStart,
}: {
  offer: TestOutOfferView;
  /** Opens a chapter's test (`chapterId`). */
  onStart: (chapterId: string) => Promise<TestOutStart>;
}) {
  const t = useExtracted();
  const { isPending, opening, result, start } = useTestOutStart(() => onStart(offer.chapterId));

  return (
    <div
      className="border-border flex items-start gap-3 border-y py-2.75"
      data-slot="test-out-offer"
    >
      <FastForwardIcon
        aria-hidden="true"
        className="text-muted-foreground mt-0.5 size-4 shrink-0"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm font-medium">{t("Is this easy for you?")}</p>
        <p className="text-muted-foreground text-xs leading-5">
          {t(
            "{count, plural, one {Take this chapter's test and skip # lesson.} other {Take this chapter's test and skip up to # lessons.}}",
            { count: offer.lessonsLeft },
          )}
        </p>
        <TestOutStartStatus isPending={isPending} result={result} />
      </div>

      <Button className="shrink-0" disabled={opening} onClick={start} size="sm" variant="outline">
        {opening ? t("Opening the test…") : t("Take the test")}
      </Button>
    </div>
  );
}
