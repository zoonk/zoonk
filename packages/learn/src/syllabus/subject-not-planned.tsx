"use client";

import { type WrittenPractice } from "@zoonk/core/plans/written-practice-contract";
import { type SyllabusSubject } from "@zoonk/core/view-models/syllabus/contract";
import { Button } from "@zoonk/ui/components/button";
import { safeAsync } from "@zoonk/utils/error";
import { CircleMinusIcon, ListPlusIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useTransition } from "react";
import { NoticeCard } from "../_components/notice-card";
import { useChangeSaveFailed } from "../_components/save-error";
import { useSentenceSpace } from "../_utils/locale";
import { LearnLink } from "../learn-link";

/** Each resolves to whether it was saved. */
export type SubjectActions = {
  restore: (areas: string[]) => Promise<boolean>;
  setWrittenCadence: (cadence: WrittenPractice["cadence"]) => Promise<boolean>;
};

function RestoreButton({
  areas,
  restore,
}: {
  areas: string[];
  restore: SubjectActions["restore"];
}) {
  const t = useExtracted();
  const saveFailed = useChangeSaveFailed();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-start gap-1.5">
      <form
        action={() =>
          startTransition(async () => {
            const { data: restored } = await safeAsync(() => restore(areas));

            if (!restored) {
              saveFailed();
            }
          })
        }
        className="contents"
      >
        <Button
          busy={isPending}
          icon={<ListPlusIcon aria-hidden="true" />}
          size="sm"
          type="submit"
          variant="outline"
        >
          {t("Add it back")}
        </Button>
      </form>
    </div>
  );
}

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
  const space = useSentenceSpace();

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
            {t("This subject isn't in your plan: not enough time before your exam.")}
            {space}
            <LearnLink className="font-medium underline underline-offset-2" href={adjustHref}>
              {t("Adjust plan")}
            </LearnLink>
          </p>
        )}
        {reason === "missing" && <p>{t("This subject isn't in your plan yet.")}</p>}
        {reason === "skipped" && <RestoreButton areas={subject.areas} restore={actions.restore} />}
      </div>
    </NoticeCard>
  );
}
