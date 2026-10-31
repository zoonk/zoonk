"use client";

import { useExtracted } from "next-intl";
import { PlusNotice } from "../_components/plus-lock";
import { TaskActions } from "../_components/task-layout";
import { useLearnRoutes } from "../learn-context";
import { TaskMainLink } from "../shell/task-frame";

export function ChallengeCallPlusNotice({ cta = false }: { cta?: boolean }) {
  const t = useExtracted();

  return (
    <PlusNotice cta={cta}>
      {t("Challenge calls come with Plus. Your plan keeps going without them.")}
    </PlusNotice>
  );
}

export function SeePlusAction() {
  const t = useExtracted();
  const routes = useLearnRoutes();

  return (
    <TaskActions>
      <TaskMainLink href={routes.upgrade}>{t("See Plus")}</TaskMainLink>
    </TaskActions>
  );
}
