"use client";

import { type ChallengeView } from "@zoonk/core/checkpoints/challenge-contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
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

function ChallengeIntroScreen() {
  const { hrefs } = useChallengeScreen();
  const aside = useChallengeIntroAside();

  return (
    <TaskFrame aside={aside} closeOnEscape exitHref={hrefs.exit} footer={<ChallengeFooter />}>
      <ChallengeIntro />
    </TaskFrame>
  );
}

export function ChallengeScreen({
  actions,
  challenge,
  hrefs,
  moved,
  rereading = false,
  writing = null,
}: {
  actions: ChallengeActions;
  challenge: ChallengeView;
  hrefs: ChallengeHrefs;
  moved: { changeId: string; effect: PlanChangeView["effect"] | null } | null;
  rereading?: boolean;
  writing?: ChallengeWriting | null;
}) {
  const move = useChallengeMove(actions);
  const ownStart = useChallengeStart(actions);
  const start = rereading ? { ...ownStart, busy: true } : ownStart;

  return (
    <ChallengeProvider value={{ challenge, hrefs, move, start, writing }}>
      {moved && <ChallengeMovedScreen changeId={moved.changeId} effect={moved.effect} />}
      {!moved && writing?.kind === "writing" && <ChallengeWritingScreen run={writing.run} />}
      {!moved && writing?.kind !== "writing" && <ChallengeIntroScreen />}
    </ChallengeProvider>
  );
}
