"use client";

import { Button } from "@zoonk/ui/components/button";
import { safeAsync } from "@zoonk/utils/error";
import { ArchiveIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { EnterButton } from "../_components/enter-button";
import { ChangeSaveError } from "../_components/save-error";
import { ArchiveGoal } from "../journey/archive-goal";
import { STUDY_AFTER_EXAM } from "../plan/plan-full-course";
import { useTodayScreen } from "./today-context";
import { TODAY_ACTION_STATUS_CLASS } from "./today-layout";

const BUTTON_CLASS = "w-full text-reading sm:w-auto";

/**
 * An exam whose date passed with lessons left: the learner studies them or archives the goal.
 * Either answer ends this state, so nothing remembers that it was asked.
 */
export function TodayExamOver() {
  const t = useExtracted();
  const { actions, today } = useTodayScreen();
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const keepStudying = () => {
    setFailed(false);

    startTransition(async () => {
      const { data: change } = await safeAsync(() => actions.changePlan(STUDY_AFTER_EXAM));

      if (!change) {
        setFailed(true);
        return;
      }

      await safeAsync(async () => actions.refresh());
    });
  };

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <ArchiveGoal
          goalTitle={today.goal.displayName}
          onSetStatus={async () => ((await actions.archiveGoal()) ? "saved" : "failed")}
        >
          {(archive) => (
            <Button
              busy={archive.pending}
              className={BUTTON_CLASS}
              disabled={isPending}
              icon={<ArchiveIcon aria-hidden="true" />}
              onClick={archive.ask}
              size="lg"
              variant="outline"
            >
              {t("Archive goal")}
            </Button>
          )}
        </ArchiveGoal>

        <form action={keepStudying} className="contents">
          <EnterButton busy={isPending} className={BUTTON_CLASS} size="lg" type="submit">
            {t("Keep studying")}
          </EnterButton>
        </form>
      </div>

      <span className={TODAY_ACTION_STATUS_CLASS} data-speaking={failed || undefined}>
        {failed && <ChangeSaveError />}
      </span>
    </>
  );
}
