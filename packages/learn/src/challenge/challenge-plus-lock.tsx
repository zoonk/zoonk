"use client";

import { useExtracted } from "next-intl";
import { PlusNotice } from "../_components/plus-lock";
import { TaskActions } from "../_components/task-layout";
import { useLearnRoutes } from "../learn-context";
import { TaskMainLink } from "../shell/task-frame";

/**
 * A language goal's challenge call the learner's plan leaves to Plus (the free plan, or Plus that
 * lapsed), said the same way on its challenge intro and on its call: "Available with Plus", that
 * the plan goes on without it (nothing waits for a call the learner can't make), and "See Plus" as
 * the screen's main action. A completed result keeps Continue as its main action and includes
 * the notice's own Plus link (`cta`).
 */
export function ChallengeCallPlusNotice({ cta = false }: { cta?: boolean }) {
  const t = useExtracted();

  return (
    <PlusNotice cta={cta}>
      {t("Challenge calls come with Plus. Your plan keeps going without them.")}
    </PlusNotice>
  );
}

/** "See Plus" as a task's main action, where Start would be. */
export function SeePlusAction() {
  const t = useExtracted();
  const routes = useLearnRoutes();

  return (
    <TaskActions>
      <TaskMainLink href={routes.upgrade}>{t("See Plus")}</TaskMainLink>
    </TaskActions>
  );
}
