"use client";

import { type WrittenPractice } from "@zoonk/core/plans/written-practice-contract";
import {
  type NotPlannedReason,
  type SyllabusSubject,
} from "@zoonk/core/view-models/syllabus/contract";
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
  /** Starts a written task of this part and opens it; false when it couldn't. */
  write?: () => Promise<boolean>;
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

function useReasonLine(isModule: boolean) {
  const t = useExtracted();

  return function reasonLine(reason: NotPlannedReason | null): string | null {
    switch (reason) {
      case "skipped":
        return isModule
          ? t({
              description:
                "On a module's page, on a plan that isn't for an exam: the learner took this module out of their plan. Followed by a button to add it back.",
              message: "You took this module out of your plan.",
            })
          : t("You took this subject out of your plan.");
      case "time":
        return isModule
          ? t({
              description:
                "Why a module isn't in the learner's plan, on a plan that isn't for an exam: their study time goes to modules that matter more first. Followed by a link to change the plan.",
              message: "This module isn't in your plan. Other modules come first.",
            })
          : t({
              description:
                "Why a subject isn't in the learner's plan: their study time goes to subjects that matter more first. Followed by a link to change the plan.",
              message: "This subject isn't in your plan. Other subjects come first.",
            });
      case "missing":
        return isModule
          ? t({
              description:
                "On a module's page, on a plan that isn't for an exam: no lesson of the plan teaches this module yet.",
              message: "This module isn't in your plan yet.",
            })
          : t("This subject isn't in your plan yet.");
      case "known":
      case "pastBasics":
      case "skippedBase":
      case null:
        return null;
      default:
        return reason satisfies never;
    }
  };
}

/** `isModule`: the plan isn't for an exam, so the page is a module's. */
export function NotPlannedCallout({
  actions,
  adjustHref,
  isModule,
  subject,
}: {
  actions: SubjectActions;
  adjustHref: string;
  isModule: boolean;
  subject: SyllabusSubject;
}) {
  const t = useExtracted();
  const reason = subject.notPlannedReason;
  const space = useSentenceSpace();
  const line = useReasonLine(isModule)(reason);

  if (!line) {
    return null;
  }

  return (
    <NoticeCard>
      <CircleMinusIcon aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <p>
          {line}
          {reason === "time" && (
            <>
              {space}
              <LearnLink className="font-medium underline underline-offset-2" href={adjustHref}>
                {t("Adjust plan")}
              </LearnLink>
            </>
          )}
        </p>
        {reason === "skipped" && <RestoreButton areas={subject.areas} restore={actions.restore} />}
      </div>
    </NoticeCard>
  );
}
