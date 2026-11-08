"use client";

import { type LibraryLessonCompletion } from "@zoonk/core/lesson-player/contract";
import {
  ListGroup,
  ListRow,
  ListRowContent,
  ListRowDescription,
  ListRowIcon,
  ListRowLeading,
  ListRowTitle,
} from "@zoonk/learn/list";
import { PageSectionLabel } from "@zoonk/learn/page";
import { DoneMark } from "@zoonk/learn/status-mark";
import {
  TASK_MAIN_ACTION_CLASS,
  TaskActionBar,
  TaskActionLabel,
  TaskActions,
} from "@zoonk/learn/task-layout";
import { buttonVariants } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { MapIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useLessonPlayerConfig } from "../lesson-player-context";

type PlanReveal = NonNullable<LibraryLessonCompletion["planReveal"]>;

/** What the goal's first lesson leads to when the learner hasn't seen their plan yet. */
export function LessonCompletionPlan({ reveal }: { reveal: PlanReveal }) {
  const t = useExtracted();

  return (
    <section className="flex flex-col gap-2" data-slot="lesson-completion-plan">
      <PageSectionLabel>{t("What's next")}</PageSectionLabel>

      <ListGroup>
        <ListRow>
          <ListRowLeading>
            <ListRowIcon>{reveal.planReady ? <DoneMark /> : <MapIcon />}</ListRowIcon>
          </ListRowLeading>

          <ListRowContent>
            <ListRowTitle>
              {reveal.planReady ? t("Your plan is ready") : t("Building your plan")}
            </ListRowTitle>
            <ListRowDescription>{reveal.goalTitle}</ListRowDescription>
          </ListRowContent>
        </ListRow>
      </ListGroup>
    </section>
  );
}

export function SeePlanAction({ reveal }: { reveal: PlanReveal }) {
  const t = useExtracted();
  const { linkComponent: LinkComponent, routes } = useLessonPlayerConfig();
  const ref = useEnterClick<HTMLAnchorElement>();

  return (
    <TaskActionBar>
      <TaskActions>
        <LinkComponent
          aria-keyshortcuts="Enter"
          className={cn(buttonVariants({ size: "xl" }), TASK_MAIN_ACTION_CLASS)}
          href={routes.seePlan(reveal.goalId)}
          ref={ref}
        >
          <TaskActionLabel>{t("See your plan")}</TaskActionLabel>
          <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
        </LinkComponent>
      </TaskActions>
    </TaskActionBar>
  );
}
