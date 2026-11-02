"use client";

import { useExtracted } from "next-intl";
import { TaskHeaderTitle } from "../_components/task-header";
import { TaskActions } from "../_components/task-layout";
import { TaskFrame, TaskMainLink } from "../shell/task-frame";
import { useEssayScreen } from "./essay-context";
import { EssayGradeSteps } from "./essay-feedback";
import { EssayInstruction, usePromptLabel } from "./essay-prompt";

function SkippedEssay() {
  const t = useExtracted();
  const { essay, hrefs } = useEssayScreen();
  const label = usePromptLabel(essay.rubric);

  return (
    <TaskFrame
      exitHref={hrefs.exit}
      footer={
        <TaskActions>
          <TaskMainLink href={hrefs.exit}>{t("Back to Today")}</TaskMainLink>
        </TaskActions>
      }
      headerTitle={<TaskHeaderTitle title={label} />}
    >
      <EssayInstruction context={null} />
      <p className="text-muted-foreground">{t("You skipped this essay.")}</p>
    </TaskFrame>
  );
}

export function ClosedEssay() {
  const { essay } = useEssayScreen();
  const grade = essay.drafts[0]?.grade;

  return grade ? <EssayGradeSteps grade={grade} /> : <SkippedEssay />;
}
