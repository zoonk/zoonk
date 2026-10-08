"use client";

import {
  GenerationTimelineDescription,
  GenerationTimelineTitle,
} from "@zoonk/ui/components/generation-timeline";
import { FastForwardIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type HelpLimit, HelpLimitNotice } from "../_components/help-limit-notice";
import { KindTile } from "../_components/kind-tile";
import { type GenerationRun } from "../generation/generation-run";
import { GenerationWait } from "../generation/generation-wait";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { TaskMainButton } from "../shell/task-frame";
import { QuestionsHeader } from "./questions-header";

/**
 * The test before it's asked for: its tile, the question it answers big ("Already know this?"),
 * and what doing well does. The header already names the chapter.
 */
function TestOutCard() {
  const t = useExtracted();

  return (
    <div className="bg-card flex flex-col items-center gap-4 rounded-3xl border px-6 py-8 text-center shadow-xs sm:px-8">
      <KindTile icon={FastForwardIcon} kind="challenge" size="lg" />
      <div className="flex flex-col items-center gap-1.5">
        <h2 className="text-3xl font-bold tracking-tight text-balance">
          {t("Already know this?")}
        </h2>
        <p className="text-muted-foreground text-balance">
          {t(
            "A few questions on this chapter. Do well, and your plan skips what you already know.",
          )}
        </p>
      </div>
    </div>
  );
}

/**
 * A chapter's test-out while its questions are written: the run's progress under the task's
 * header, and the test opens by itself once they exist (the host reads the page again). Opened
 * without a run (a link from elsewhere), it shows the test as one card and waits for the learner's
 * Start (or Enter), since loading a page never writes anything; a refusal says why with the one
 * thing to do.
 */
export function TestOutPreparing({
  chapterTitle,
  closeHref,
  limit,
  onStart,
  run,
  starting,
}: {
  chapterTitle: string;
  closeHref: string;
  /** The learner's small AI help doesn't cover writing it now. */
  limit: HelpLimit | null;
  onStart: () => void;
  /** The run writing the questions, once the learner asked for them. */
  run: GenerationRun | null;
  starting: boolean;
}) {
  const t = useExtracted();
  const routes = useLearnRoutes();

  return (
    <div className="flex min-h-dvh flex-col">
      <QuestionsHeader
        screen="test-out"
        title={t("Test out: {chapter}", { chapter: chapterTitle })}
        closeHref={closeHref}
        index={0}
        itemId={null}
        total={0}
      />

      <section className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] lg:justify-center-safe lg:py-10">
        {run ? (
          <GenerationWait kind="testOutQuestions" run={run}>
            <GenerationTimelineTitle>{t("Getting your test ready")}</GenerationTimelineTitle>
            <GenerationTimelineDescription>
              {t(
                "We're writing a few questions on this chapter. The test opens here when they're ready.",
              )}
            </GenerationTimelineDescription>
          </GenerationWait>
        ) : (
          <>
            <div className="flex flex-1 flex-col justify-center lg:flex-none">
              <TestOutCard />
            </div>

            <div className="flex flex-col gap-2 pt-6">
              {limit ? (
                <HelpLimitNotice limit={limit} linkComponent={LearnLink} routes={routes} />
              ) : (
                <TaskMainButton busy={starting} onClick={onStart}>
                  {starting ? t("Starting…") : t("Start the test")}
                </TaskMainButton>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
