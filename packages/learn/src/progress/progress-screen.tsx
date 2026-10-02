"use client";

import { type ProgressView } from "@zoonk/core/view-models/progress/get";
import { useExperienceMode } from "../mode-provider";
import { ExplanationProgress } from "./explanation-progress";
import { FocusProgress } from "./focus-progress";
import { FunProgress } from "./fun-progress";
import {
  type ProgressActions,
  type ProgressHrefs,
  ProgressScreenProvider,
} from "./progress-context";

export type { AreaPracticeOutcome } from "./progress-context";

/**
 * The Progress tab: one progress view model from core, drawn as bars in Focus and as the
 * preparation ring with area planets in Fun; a quick explanation has no preparation to draw. The
 * host passes the stats pages and "Practice now".
 */
export function ProgressScreen({
  actions,
  hrefs,
  progress,
}: {
  actions: ProgressActions;
  hrefs: ProgressHrefs;
  progress: ProgressView;
}) {
  const mode = useExperienceMode();

  return (
    <ProgressScreenProvider value={{ actions, hrefs, progress }}>
      {progress.preparation === null && <ExplanationProgress />}
      {progress.preparation !== null && (mode === "fun" ? <FunProgress /> : <FocusProgress />)}
    </ProgressScreenProvider>
  );
}
