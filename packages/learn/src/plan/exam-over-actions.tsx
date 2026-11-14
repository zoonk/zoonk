"use client";

import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { Button } from "@zoonk/ui/components/button";
import { ArchiveIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { EnterButton } from "../_components/enter-button";
import { TASK_WRAPPING_ACTION_CLASS } from "../_components/task-layout";
import { ArchiveGoal } from "../journey/archive-goal";
import { type GoalStatusControl } from "../journey/goal-actions";
import { usePlanScreen } from "./plan-context";
import { STUDY_AFTER_EXAM } from "./plan-full-course";
import { usePlanChange } from "./use-plan-change";

/**
 * An exam whose date passed with lessons left, answered in a bar: archive the goal (it asks first),
 * or keep studying, the main action. Either answer ends the state, so nothing remembers it was asked.
 */
export function ExamOverActions({
  goalTitle,
  keeping,
  onArchive,
  onKeepStudying,
}: {
  goalTitle: string;
  keeping: boolean;
  onArchive: GoalStatusControl["onSetStatus"];
  onKeepStudying: () => void;
}) {
  const t = useExtracted();

  return (
    <>
      <ArchiveGoal goalTitle={goalTitle} onSetStatus={onArchive}>
        {(archive) => (
          <Button
            busy={archive.pending}
            className={TASK_WRAPPING_ACTION_CLASS}
            disabled={keeping}
            icon={<ArchiveIcon aria-hidden="true" />}
            onClick={archive.ask}
            size="xl"
            variant="outline"
          >
            {t("Archive goal")}
          </Button>
        )}
      </ArchiveGoal>

      <form action={onKeepStudying} className="contents">
        <EnterButton busy={keeping} type="submit">
          {t("Keep studying")}
        </EnterButton>
      </form>
    </>
  );
}

/** The Plan's bar after its exam: the same answers as Today's, and a failed save in the toast. */
export function PlanExamOverBar({ goalStatus }: { goalStatus: GoalStatusControl }) {
  const { goal } = usePlanScreen();
  const { change, isPending } = usePlanChange();

  return (
    <BottomBar>
      <BottomBarActions>
        <ExamOverActions
          goalTitle={goal.displayName}
          keeping={isPending}
          onArchive={goalStatus.onSetStatus}
          onKeepStudying={() => void change(STUDY_AFTER_EXAM)}
        />
      </BottomBarActions>
    </BottomBar>
  );
}
