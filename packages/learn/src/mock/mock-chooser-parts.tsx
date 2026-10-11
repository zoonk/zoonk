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
import { useFormatDuration } from "../_utils/time-format";
import { type GenerationRun } from "../generation/generation-run";
import { GenerationWait } from "../generation/generation-wait";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { TaskFrame } from "../shell/task-frame";

/**
 * The picked mock can ask only part of its questions now, and nothing more can be written for it:
 * how many of how many, in how long, and whether fair use for new ones renews the next day or
 * month (`limit`). Start then takes it as it is.
 */
type MockShortStatus = {
  examQuestions: number;
  kind: "short";
  limit: "day" | "month" | "total" | null;
  minutes: number;
  /** The option it's for: picking another one asks again. */
  optionKey: string;
  questions: number;
};

/**
 * Where the chooser stands: picking, the run writing the picked mock's questions, a mock that can
 * ask only part of its questions now, or why it couldn't start (a bank with too few questions even
 * after writing, AI help used up for now, or a request that failed).
 */
export type MockChooserStatus =
  | { kind: "choosing" }
  | { kind: "writing"; run: GenerationRun }
  | MockShortStatus
  | { kind: "failed"; reason: "failed" | "notEnoughQuestions" }
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

  return (reason: Extract<MockChooserStatus, { kind: "failed" }>["reason"]): string =>
    reason === "notEnoughQuestions"
      ? t("There aren't enough questions for this mock yet. Try the full exam or another subject.")
      : t("We couldn't start the mock. Try again.");
}

/** How much of the picked mock is ready, and when more can be written, before it starts. */
function ShortNotice({ status }: { status: MockShortStatus }) {
  const t = useExtracted();
  const duration = useFormatDuration();

  const size = {
    questions: status.questions,
    time: duration(status.minutes),
    total: status.examQuestions,
  };

  return (
    <p className="text-muted-foreground text-center text-sm text-balance" role="status">
      {t(
        "{questions, plural, one {# of the {total, number} questions is ready now} other {# of the {total, number} questions are ready now}}, so this mock takes about {time}.",
        size,
      )}{" "}
      {status.limit === "day" && t("More can be written for your mocks tomorrow.")}
      {status.limit === "month" && t("More can be written for your mocks next month.")}
      {status.limit !== "day" &&
        status.limit !== "month" &&
        t("The question bank doesn't have more new ones for it yet.")}
    </p>
  );
}

/** What stops the mock now, said under the options with the way out. */
export function ChooserProblem({ status }: { status: MockChooserStatus }) {
  const failureText = useFailureText();
  const routes = useLearnRoutes();

  if (status.kind === "short") {
    return <ShortNotice status={status} />;
  }

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
