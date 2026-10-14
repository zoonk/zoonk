"use client";

import { type ChallengeView } from "@zoonk/core/checkpoints/challenge-contract";
import {
  GenerationTimelineDescription,
  GenerationTimelineTitle,
} from "@zoonk/ui/components/generation-timeline";
import { useExtracted } from "next-intl";
import { type GenerationRun } from "../generation/generation-run";
import { GenerationWait } from "../generation/generation-wait";
import { TaskFrame } from "../shell/task-frame";
import {
  type ChallengeActions,
  type ChallengeHrefs,
  ChallengeProvider,
  type ChallengeWriting,
  useChallengeScreen,
} from "./challenge-context";
import { ChallengeFooter } from "./challenge-footer";
import { ChallengeIntro, useChallengeIntroAside } from "./challenge-intro";
import { ChallengeMovedScreen } from "./challenge-moved-screen";
import { useChallengeMove } from "./use-challenge-move";
import { useChallengeStart } from "./use-challenge-start";

export type { ChallengeActions, ChallengeWriting } from "./challenge-context";

/**
 * The questions Start asked for, being written: the run's progress in place of the intro, and the
 * challenge starts by itself once they're in (the host starts it again).
 */
function ChallengeWritingScreen({ run }: { run: GenerationRun }) {
  const t = useExtracted();
  const { hrefs } = useChallengeScreen();

  return (
    <TaskFrame exitHref={hrefs.exit}>
      <GenerationWait kind="challengeQuestions" run={run}>
        <GenerationTimelineTitle>{t("Getting your challenge ready")}</GenerationTimelineTitle>
        <GenerationTimelineDescription>
          {t("We're writing its questions. It starts here when they're ready.")}
        </GenerationTimelineDescription>
      </GenerationWait>
    </TaskFrame>
  );
}

/** The intro in the task's chrome, its aside from `lg`, and the challenge's actions in the bar. */
function ChallengeIntroScreen() {
  const { hrefs } = useChallengeScreen();
  const aside = useChallengeIntroAside();

  return (
    <TaskFrame aside={aside} closeOnEscape exitHref={hrefs.exit} footer={<ChallengeFooter />}>
      <ChallengeIntro />
    </TaskFrame>
  );
}

/**
 * A phase's checkpoint (the Trickster) or the week's challenge (an exam's mock), before its day
 * and on it: what it asks and what it's worth, then, on its day, one button that starts it. One
 * whose questions aren't in the shared bank yet has them written as it starts (`writing`). The
 * week's challenge can move to Monday before it starts. The host supplies the challenge, how to
 * reach the server and where to go.
 */
export function ChallengeScreen({
  actions,
  challenge,
  hrefs,
  movedBy,
  writing = null,
}: {
  actions: ChallengeActions;
  challenge: ChallengeView;
  hrefs: ChallengeHrefs;
  /** The plan change that just moved it here, whose undo takes it back. */
  movedBy: string | null;
  writing?: ChallengeWriting | null;
}) {
  const move = useChallengeMove(actions);
  const start = useChallengeStart(actions);

  return (
    <ChallengeProvider value={{ challenge, hrefs, move, start, writing }}>
      {movedBy && <ChallengeMovedScreen changeId={movedBy} />}
      {!movedBy && writing?.kind === "writing" && <ChallengeWritingScreen run={writing.run} />}
      {!movedBy && writing?.kind !== "writing" && <ChallengeIntroScreen />}
    </ChallengeProvider>
  );
}
