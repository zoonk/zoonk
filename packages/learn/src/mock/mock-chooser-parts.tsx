"use client";

import {
  GenerationTimelineDescription,
  GenerationTimelineTitle,
} from "@zoonk/ui/components/generation-timeline";
import { EyeOffIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Callout } from "../_components/callout";
import { type HelpLimit, HelpLimitNotice } from "../_components/help-limit-notice";
import { PlusNotice } from "../_components/plus-lock";
import { type GenerationRun } from "../generation/generation-run";
import { GenerationWait } from "../generation/generation-wait";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { TaskFrame } from "../shell/task-frame";

/**
 * Where the chooser stands: picking, the run writing the picked mock's questions, or why it
 * couldn't start (a guardian's limit for today, a bank with too few questions even after writing,
 * AI help used up for now, or a request that failed).
 */
export type MockChooserStatus =
  | { kind: "choosing" }
  | { kind: "writing"; run: GenerationRun }
  | { kind: "failed"; reason: "dailyLimit" | "failed" | "notEnoughQuestions" }
  | { kind: "refused"; limit: HelpLimit };

/** The one rule that changes how to take it, as on exam day. */
export function ResultRule() {
  const t = useExtracted();

  return (
    <Callout>
      <EyeOffIcon aria-hidden="true" />
      <p>{t("Your result only shows at the end, like on exam day.")}</p>
    </Callout>
  );
}

/**
 * Every mock exam comes with Plus: the options stay visible, so the learner sees what it gives,
 * with Plus's one notice under them; the screen's main action is "See Plus", so the notice has no
 * link of its own. In onboarding (`placement`), it says the quick questions set the starting point
 * without it.
 */
export function MockPlusNotice({ placement = false }: { placement?: boolean }) {
  const t = useExtracted();

  return (
    <PlusNotice cta={false}>
      {placement
        ? t("Mock exams come with Plus. Without it, the quick questions find your starting point.")
        : t("Mock exams come with Plus: whenever you want, and every week in your plan.")}
    </PlusNotice>
  );
}

function useFailureText() {
  const t = useExtracted();

  return (reason: Extract<MockChooserStatus, { kind: "failed" }>["reason"]): string => {
    if (reason === "dailyLimit") {
      return t("Today's study time is used up. Come back tomorrow for this mock.");
    }

    return reason === "notEnoughQuestions"
      ? t("There aren't enough questions for this mock yet. Try the full exam or another subject.")
      : t("We couldn't start the mock. Try again.");
  };
}

/** What stops the mock now, said under the options with the way out. */
export function ChooserProblem({ status }: { status: MockChooserStatus }) {
  const failureText = useFailureText();
  const routes = useLearnRoutes();

  if (status.kind === "failed") {
    return (
      <p className="text-destructive text-center text-sm" role="alert">
        {failureText(status.reason)}
      </p>
    );
  }

  if (status.kind === "refused") {
    return <HelpLimitNotice limit={status.limit} linkComponent={LearnLink} routes={routes} />;
  }

  return null;
}

/** While the picked mock's questions are written: the run's progress, and that it starts here. */
export function MockWriting({ exitHref, run }: { exitHref: string; run: GenerationRun }) {
  const t = useExtracted();

  return (
    <TaskFrame exitHref={exitHref} exitToApp>
      <div className="flex flex-1 flex-col justify-center">
        <GenerationWait kind="mockQuestions" run={run}>
          {/* oxlint-disable-next-line jsx-a11y/heading-has-content -- The title's text is its children. */}
          <GenerationTimelineTitle render={<h1 />}>
            {t("Preparing your mock exam")}
          </GenerationTimelineTitle>
          <GenerationTimelineDescription>
            {t(
              "We're writing questions like the exam's for you. It starts here as soon as they're ready.",
            )}
          </GenerationTimelineDescription>
        </GenerationWait>
      </div>
    </TaskFrame>
  );
}
