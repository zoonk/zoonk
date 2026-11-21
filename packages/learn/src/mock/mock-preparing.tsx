"use client";

import {
  GenerationTimelineProgress,
  GenerationTimelineStatus,
} from "@zoonk/ui/components/generation-timeline";
import { FACT_SEPARATOR } from "@zoonk/utils/facts";
import { sumOf } from "@zoonk/utils/number";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { GateWords } from "../_components/subscribe-gate";
import { useAppLocale } from "../_utils/locale";
import { useFormatDuration } from "../_utils/time-format";
import { getPhaseProgress } from "../generation/_utils/phase-progress";
import { FollowedRun } from "../generation/generation-follower";
import { getGenerationKind } from "../generation/generation-kinds";
import { type GenerationRun } from "../generation/generation-run";
import { useGenerationStepLabel } from "../generation/generation-step-label";
import { useGenerationProgress } from "../generation/generation-wait";
import { useGenerationCopy } from "../generation/use-generation-copy";
import { useVisibleWait } from "../generation/use-visible-wait";
import { useLearnAnalytics } from "../learn-context";

/** GET /goals/{goalId}/mock-writing: the run writing the paper the learner waits for. */
export type MockWriting = {
  generationId: string | null;
  namespace: string | null;
  status: "none" | "starting" | "writing";
};

export type MockWritingWait = {
  read: () => Promise<MockWriting>;
  /** The run says the paper is written: read the screen again, which then offers Start. */
  written: () => void;
};

const SECONDS_PER_MINUTE = 60;

function MockPreparingWords({ title }: { title: string }) {
  const t = useExtracted();

  return (
    <GateWords
      line={t({
        description:
          "Shown right under a line saying the mock exam is being prepared; 'it' is the mock exam, so don't repeat the noun.",
        message: "Come back to this page to start it.",
      })}
      title={title}
    />
  );
}

function useTimeLeft({ seconds, value }: { seconds: number; value: number }): string {
  const t = useExtracted();
  const duration = useFormatDuration();
  const left = (seconds * (100 - value)) / 100;

  return t("About {time} left", {
    time: duration(Math.max(1, Math.ceil(left / SECONDS_PER_MINUTE))),
  });
}

function MockWritingProgress({
  goalId,
  run,
  surface,
  title,
}: {
  goalId: string;
  run: GenerationRun;
  surface: string;
  title: string;
}) {
  const { track } = useLearnAnalytics();

  useVisibleWait({
    contentKind: "mockPaper",
    enabled: run.status === "waiting" || run.status === "following",
    goalId,
    surface,
    track,
  });

  const locale = useAppLocale();
  const copy = useGenerationCopy("mockPaper");
  const step = useGenerationStepLabel({ kind: "mockPaper", run });
  const value = useGenerationProgress({ kind: "mockPaper", run });
  const progress = getPhaseProgress({ definition: getGenerationKind("mockPaper"), run });
  const weights = progress.phases.map((phase) => phase.seconds);
  const timeLeft = useTimeLeft({ seconds: sumOf(weights), value });

  // The bar's note reads out what changes in it; the step's status says each step once instead
  // of every tick of the bar and the time left.
  return (
    <div
      className="flex w-full min-w-0 flex-col gap-1.5 lg:ms-auto lg:max-w-sm"
      data-slot="mock-writing"
    >
      <p className="text-sm font-medium">{title}</p>

      <div aria-live="off" className="flex flex-col gap-1.5">
        <GenerationTimelineProgress
          aria-label={copy.name}
          locale={locale}
          statuses={progress.phases.map((phase) => phase.status)}
          value={value}
          weights={weights}
        />

        <p className="text-muted-foreground text-sm">
          {progress.progress === 100 ? step : [step, timeLeft].filter(Boolean).join(FACT_SEPARATOR)}
        </p>
      </div>

      <GenerationTimelineStatus>{step}</GenerationTimelineStatus>
    </div>
  );
}

/**
 * A mock being prepared, over the bar where Start goes: the run writing its paper as it goes, and
 * about how long is left. With nothing writing it (what was written fell short, or the run stopped),
 * the daily preparation goes on with it, so the note says to come back.
 */
export function MockPreparingNote({
  goalId,
  surface,
  title,
  wait,
}: {
  goalId: string;
  surface: "mockChooser" | "scheduledMock";
  title: string;
  wait: MockWritingWait;
}) {
  const [idle, setIdle] = useState(false);

  if (idle) {
    return <MockPreparingWords title={title} />;
  }

  const readGenerationId = async () => {
    const writing = await wait.read();
    setIdle(writing.status === "none");

    return writing.generationId && writing.namespace
      ? { id: writing.generationId, namespace: writing.namespace }
      : writing.generationId;
  };

  return (
    <FollowedRun
      generationId={null}
      kind="mockPaper"
      onReady={wait.written}
      readGenerationId={readGenerationId}
      restart={() => Promise.resolve(null)}
    >
      {(run) =>
        run.status === "failed" ? (
          <MockPreparingWords title={title} />
        ) : (
          <MockWritingProgress goalId={goalId} run={run} surface={surface} title={title} />
        )
      }
    </FollowedRun>
  );
}
