"use client";

import { type WrittenPractice } from "@zoonk/core/plans/written-practice-contract";
import { type SyllabusSubject } from "@zoonk/core/view-models/syllabus/contract";
import { Button } from "@zoonk/ui/components/button";
import { CircleMinusIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { NoticeCard } from "../_components/notice-card";
import { LearnLink } from "../learn-link";

/**
 * Brings a subject the learner took out back into the plan, by the plan's areas it gathers, and
 * changes when the exam's written tests are practiced. Each resolves to whether it was saved.
 */
export type SubjectActions = {
  restore: (areas: string[]) => Promise<boolean>;
  setWrittenCadence: (cadence: WrittenPractice["cadence"]) => Promise<boolean>;
};

/** "Bring it back" for a subject the learner took out: the plan makes room for it again. */
function RestoreButton({
  areas,
  restore,
}: {
  areas: string[];
  restore: SubjectActions["restore"];
}) {
  const t = useExtracted();
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setFailed(!(await restore(areas)));
          })
        }
        size="sm"
        variant="outline"
      >
        {t("Bring it back")}
      </Button>
      {failed && (
        <p className="text-destructive text-sm" role="status">
          {t("That didn't work. Try again in a moment.")}
        </p>
      )}
    </div>
  );
}

/** Says plainly when the subject isn't in the plan, and the way to bring it in. */
export function NotPlannedCallout({
  actions,
  adjustHref,
  subject,
}: {
  actions: SubjectActions;
  adjustHref: string;
  subject: SyllabusSubject;
}) {
  const t = useExtracted();
  const reason = subject.notPlannedReason;

  if (!reason) {
    return null;
  }

  return (
    <NoticeCard>
      <CircleMinusIcon aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        {reason === "skipped" && <p>{t("You took this subject out of your plan.")}</p>}
        {reason === "time" && (
          <p>
            {t("It doesn't fit in the time you have.")}{" "}
            <LearnLink className="font-medium underline underline-offset-4" href={adjustHref}>
              {t("Adjust plan")}
            </LearnLink>
          </p>
        )}
        {reason === "missing" && <p>{t("Your plan doesn't teach this subject yet.")}</p>}
        {reason === "skipped" && <RestoreButton areas={subject.areas} restore={actions.restore} />}
      </div>
    </NoticeCard>
  );
}
