"use client";

import { Button, buttonVariants } from "@zoonk/ui/components/button";
import {
  GenerationTimelineDescription,
  GenerationTimelineTitle,
} from "@zoonk/ui/components/generation-timeline";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronLeftIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type HelpLimit, HelpLimitNotice } from "../_components/help-limit-notice";
import { type GenerationRun } from "../generation/generation-run";
import { GenerationWait } from "../generation/generation-wait";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";

/**
 * A chapter's test-out before it has questions: the learner asks for them (a tap, never the page
 * load), follows them being written, and the test opens once they exist (the host reads the page
 * again). The plan stays one tap away, and a refusal says why with the one thing to do.
 */
export function TestOutPreparing({
  backHref,
  chapterTitle,
  limit,
  onStart,
  run,
  starting,
}: {
  backHref: string;
  chapterTitle: string;
  /** The learner's small AI help doesn't cover writing it now. */
  limit: HelpLimit | null;
  onStart: () => void;
  /** The run writing the questions, once the learner asked for them. */
  run: GenerationRun | null;
  starting: boolean;
}) {
  const t = useExtracted();
  const routes = useLearnRoutes();
  const title = t("Test out: {chapter}", { chapter: chapterTitle });

  const noQuestionsYet = t(
    "This chapter has no questions yet. We can write a few on its skills now, which takes about 20 seconds.",
  );

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-6 py-6">
      <LearnLink
        className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "-ml-2.5 self-start")}
        href={backHref}
      >
        <ChevronLeftIcon aria-hidden="true" />
        {t("Back to the plan")}
      </LearnLink>

      {run ? (
        <GenerationWait kind="testOutQuestions" run={run}>
          <GenerationTimelineTitle>{title}</GenerationTimelineTitle>
          <GenerationTimelineDescription>
            {/* A run that stopped claims nothing: its alert says what happened. */}
            {run.status === "failed"
              ? noQuestionsYet
              : t(
                  "We're writing a few questions on this chapter. They open here as soon as they're ready.",
                )}
          </GenerationTimelineDescription>
        </GenerationWait>
      ) : (
        <div className="flex flex-col gap-3">
          <GenerationTimelineTitle>{title}</GenerationTimelineTitle>
          <GenerationTimelineDescription>{noQuestionsYet}</GenerationTimelineDescription>

          {limit ? (
            <HelpLimitNotice
              className="mt-2"
              limit={limit}
              linkComponent={LearnLink}
              routes={routes}
            />
          ) : (
            <Button className="mt-2 self-start" disabled={starting} onClick={onStart} size="lg">
              {starting ? t("Starting…") : t("Get my questions ready")}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
