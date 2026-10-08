"use client";

import { Button } from "@zoonk/ui/components/button";
import { FastForwardIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Callout } from "../_components/callout";
import {
  type TestOutStart,
  TestOutStartStatus,
  useTestOutStart,
} from "../_components/test-out-start-link";
import { type StudyMomentView } from "./session-types";

type TestOutOfferView = NonNullable<StudyMomentView["testOutOffer"]>;

/**
 * Right after the second lesson in a row of a chapter with every answer right, once: the chapter's
 * test, which skips the lessons a pass takes off the plan. Continue stays the moment's main action.
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
    <Callout className="w-full max-w-sm text-left" data-slot="test-out-offer">
      <FastForwardIcon aria-hidden="true" />

      <div className="flex min-w-0 flex-col items-start gap-3">
        <p>
          <span className="font-medium">{t("Is this easy for you?")}</span>{" "}
          {t(
            "{count, plural, one {Take this chapter's test and skip # lesson.} other {Take this chapter's test and skip up to # lessons.}}",
            { count: offer.lessonsLeft },
          )}
        </p>

        <Button disabled={opening} onClick={start} size="sm" variant="outline">
          {opening ? t("Opening the test…") : t("Take the test")}
        </Button>

        <TestOutStartStatus isPending={isPending} result={result} />
      </div>
    </Callout>
  );
}
