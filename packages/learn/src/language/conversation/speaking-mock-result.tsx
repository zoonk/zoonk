"use client";

import {
  type LanguageConversationView,
  type SpeakingMockExam,
  type SpeakingMockFeedback,
} from "@zoonk/core/language/conversations/contract";
import { Badge } from "@zoonk/ui/components/badge";
import { Button } from "@zoonk/ui/components/button";
import { useExtracted, useFormatter } from "next-intl";
import { useTransition } from "react";
import { TaskFrame, TaskMainLink } from "../../shell/task-frame";
import { useConversationTitle, useCriterionName } from "./conversation-labels";

const BAND_DIGITS = 1;

function useBandRange() {
  const format = useFormatter();

  const band = (value: number) =>
    format.number(value, {
      maximumFractionDigits: BAND_DIGITS,
      minimumFractionDigits: BAND_DIGITS,
    });

  return ({ bandHigh, bandLow }: { bandHigh: number; bandLow: number }) =>
    bandHigh === bandLow ? band(bandLow) : `${band(bandLow)}–${band(bandHigh)}`;
}

/** Each exam's own scale, so a TOEFL 4.5 isn't read as an IELTS 4.5. */
function useBandLabel() {
  const t = useExtracted();

  const labels: Record<SpeakingMockExam, string> = {
    ielts: t("Estimated band, from 0 to 9"),
    toefl: t("Estimated band, from 1 to 6"),
  };

  return (exam: SpeakingMockExam) => labels[exam];
}

function Criteria({ feedback }: { feedback: SpeakingMockFeedback }) {
  const t = useExtracted();
  const criterionName = useCriterionName();
  const range = useBandRange();

  return (
    <ul className="flex flex-col gap-3">
      {feedback.criteria.map((criterion) => (
        <li
          className="in-data-[mode=fun]:fun-glass flex flex-col gap-1.5 rounded-2xl border p-4 in-data-[mode=fun]:border-transparent"
          key={criterion.criterion}
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-semibold">
              {criterionName(criterion.criterion)}
              {criterion.criterion === feedback.focus && (
                <Badge variant="outline">{t("Focus")}</Badge>
              )}
            </h3>
            <span className="shrink-0 font-semibold whitespace-nowrap tabular-nums">
              {range(criterion)}
            </span>
          </div>
          <p className="text-muted-foreground in-data-[mode=fun]:text-fun-fg2 text-sm">
            {criterion.evidence}
          </p>
          <p className="text-sm">{criterion.tip}</p>
        </li>
      ))}
    </ul>
  );
}

/**
 * After a speaking mock: an estimated band range overall and for each of its exam's criteria, on
 * that exam's scale (IELTS 0 to 9, TOEFL 1 to 6), with the words behind it and one concrete tip
 * each, the criterion to work on first, and another try. It's an estimate from a short mock, never
 * an official score, and says so.
 */
export function SpeakingMockResult({
  conversation,
  feedback,
  nextHref,
  onTryAgain,
}: {
  conversation: LanguageConversationView;
  feedback: SpeakingMockFeedback | null;
  nextHref: string;
  onTryAgain: (() => Promise<void>) | null;
}) {
  const t = useExtracted();
  const title = useConversationTitle(conversation);
  const range = useBandRange();
  const bandLabel = useBandLabel();
  const [isPending, startTransition] = useTransition();

  return (
    <TaskFrame
      exitHref={null}
      footer={
        <>
          <TaskMainLink href={nextHref}>{t("Continue")}</TaskMainLink>
          {onTryAgain && (
            <Button
              className="w-full"
              disabled={isPending}
              onClick={() => startTransition(onTryAgain)}
              size="xl"
              variant="outline"
            >
              {t("Try another mock")}
            </Button>
          )}
        </>
      }
      headerTitle={title}
    >
      {feedback ? (
        <>
          <div className="flex flex-col gap-1 pt-2">
            <p className="in-data-[mode=fun]:font-fun-display text-5xl font-bold tabular-nums">
              {range(feedback.overall)}
            </p>
            <p className="font-medium">{bandLabel(feedback.exam)}</p>
            <p className="text-muted-foreground in-data-[mode=fun]:text-fun-fg2 text-sm">
              {t("An estimate from one short mock, not an official score.")}
            </p>
          </div>
          <Criteria feedback={feedback} />
        </>
      ) : (
        <p className="text-muted-foreground in-data-[mode=fun]:text-fun-fg2 pt-4 text-center">
          {t("We couldn't score this mock. Try again when you can talk for a few minutes.")}
        </p>
      )}
    </TaskFrame>
  );
}
