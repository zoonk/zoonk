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

/** GET /goals/{goalId}/mock-writing: the run writing the paper the learner waits for. */
export type MockWriting = { generationId: string | null; status: "none" | "starting" | "writing" };

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

function useTimeLeft({ run, value }: { run: GenerationRun; value: number }): string {
  const t = useExtracted();
  const duration = useFormatDuration();
  const { phases } = getPhaseProgress({ definition: getGenerationKind("mockPaper"), run });
  const seconds = (sumOf(phases.map((phase) => phase.seconds)) * (100 - value)) / 100;

  return t("About {time} left", {
    time: duration(Math.max(1, Math.ceil(seconds / SECONDS_PER_MINUTE))),
  });
}

function MockWritingProgress({ run, title }: { run: GenerationRun; title: string }) {
  const locale = useAppLocale();
  const copy = useGenerationCopy("mockPaper");
  const step = useGenerationStepLabel({ kind: "mockPaper", run });
  const value = useGenerationProgress({ kind: "mockPaper", run });
  const timeLeft = useTimeLeft({ run, value });
  const progress = getPhaseProgress({ definition: getGenerationKind("mockPaper"), run });
  const done = progress.progress === 100;

  return (
    <div className="flex min-w-0 flex-col gap-1.5" data-slot="mock-writing">
      <p className="text-sm font-medium">{title}</p>

      <GenerationTimelineProgress
        aria-label={copy.name}
        locale={locale}
        statuses={progress.phases.map((phase) => phase.status)}
        value={value}
        weights={progress.phases.map((phase) => phase.seconds)}
      />

      <p className="text-muted-foreground text-sm">
        {done ? step : [step, timeLeft].filter(Boolean).join(FACT_SEPARATOR)}
      </p>

      <GenerationTimelineStatus>{step}</GenerationTimelineStatus>
    </div>
  );
}

/**
 * A mock being prepared, over the bar where Start goes: the run writing its paper as it goes, and
 * about how long is left. With nothing writing it (what was written fell short, or the run stopped),
 * the daily preparation goes on with it, so the note says to come back.
 */
export function MockPreparingNote({ title, wait }: { title: string; wait: MockWritingWait }) {
  const [idle, setIdle] = useState(false);

  if (idle) {
    return <MockPreparingWords title={title} />;
  }

  const readGenerationId = async () => {
    const writing = await wait.read();
    setIdle(writing.status === "none");
    return writing.generationId;
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
          <MockWritingProgress run={run} title={title} />
        )
      }
    </FollowedRun>
  );
}
