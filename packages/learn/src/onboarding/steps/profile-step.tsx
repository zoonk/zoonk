"use client";

import { type ProfileQuestionView } from "@zoonk/core/profile/questions/contract";
import {
  type OnboardingAnswerInput,
  type OnboardingView,
} from "@zoonk/core/view-models/onboarding/contract";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { getString } from "@zoonk/utils/json";
import { ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useRef, useState } from "react";
import { LearnLink } from "../../learn-link";
import {
  type ProfileDraft,
  canSendProfileDraft,
  getPrecheckedSupports,
  toProfileAnswer,
  toProfileDraft,
  withPrecheckedSupports,
} from "../../profile-questions/profile-draft";
import { ProfileQuestionBody } from "../../profile-questions/profile-question-body";
import {
  useProfileQuestionDescription,
  useProfileQuestionTitle,
} from "../../profile-questions/profile-question-copy";
import { type FlowState } from "../_utils/answered-step";
import { getProfileProgress } from "../_utils/setup-progress";
import { StepForm } from "./step-form";

function initialDraft({
  jobPrefill,
  precheck,
  question,
}: {
  jobPrefill: string | null;
  precheck: readonly string[];
  question: ProfileQuestionView;
}): ProfileDraft {
  const draft = toProfileDraft(question);

  if (question.status !== null) {
    return draft;
  }

  if (question.id === "work" && jobPrefill) {
    return { ...draft, text: jobPrefill };
  }

  if (question.id === "learningSupport" && precheck.length > 0) {
    return withPrecheckedSupports({ conditions: precheck, draft });
  }

  return draft;
}

/**
 * Saving first keeps the lesson's link as the way in: once the answer is saved, the same click
 * goes through.
 */
function LessonOffer({ answer, href }: { answer: (() => Promise<boolean>) | null; href: string }) {
  const t = useExtracted();
  const link = useRef<HTMLAnchorElement>(null);
  const saved = useRef(false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <p className="text-muted-foreground text-sm">{t("Lesson 1 is ready.")}</p>
      <LearnLink
        className={cn(
          buttonVariants({ variant: "link" }),
          "inline-flex min-h-11 items-center gap-1",
        )}
        href={href}
        lessonWritten
        onClick={(event) => {
          if (!answer || saved.current) {
            return;
          }

          event.preventDefault();

          void answer().then((ok) => {
            if (ok) {
              saved.current = true;
              link.current?.click();
            }
          });
        }}
        ref={link}
      >
        {answer ? t("Save and start lesson 1") : t("Start lesson 1")}
        <ChevronRightIcon aria-hidden="true" data-icon="inline-end" />
      </LearnLink>
    </div>
  );
}

function ProfileStep({
  jobPrefill,
  lessonHref,
  memoryEnabled,
  nextIsSupport,
  onAnswer,
  onConditions,
  pending,
  precheck,
  progress,
  question,
}: {
  jobPrefill: string | null;
  /** Set while the first lesson is ready to open. */
  lessonHref: string | null;
  memoryEnabled: boolean;
  nextIsSupport: boolean;
  onAnswer: (input: OnboardingAnswerInput) => Promise<boolean>;
  /** The picks stay on the device, only to check rows on the supports screen that follows. */
  onConditions: (picks: string[]) => void;
  pending: boolean;
  precheck: readonly string[];
  progress: { current: number; total: number };
  question: ProfileQuestionView;
}) {
  const t = useExtracted();
  const title = useProfileQuestionTitle(question.id);
  const description = useProfileQuestionDescription({ nextIsSupport, question: question.id });

  const [draft, setDraft] = useState(() => initialDraft({ jobPrefill, precheck, question }));
  const canSend = canSendProfileDraft({ draft, from: "onboarding", question: question.id });
  const input = canSend ? toProfileAnswer({ draft, memoryEnabled, question: question.id }) : null;

  const send = () => {
    if (!input) {
      return Promise.resolve(false);
    }

    if (question.id === "conditions") {
      onConditions(draft.exclusive ? [] : draft.picks);
    }

    return onAnswer(input);
  };

  return (
    <StepForm
      canContinue={input !== null}
      description={description}
      notice={lessonHref && <LessonOffer answer={input ? send : null} href={lessonHref} />}
      onContinue={() => void send()}
      onSkip={() => {
        onConditions([]);
        void onAnswer({ answer: null, question: question.id });
      }}
      pending={pending}
      subject={t({
        description: "Which of the questions about the learner this is, such as 4 of 10.",
        message: "About you · {current, number} of {total, number}",
        values: progress,
      })}
      title={title}
    >
      <ProfileQuestionBody
        draft={draft}
        jobPrefill={jobPrefill}
        label={title}
        memoryEnabled={memoryEnabled}
        onChange={setDraft}
        prechecked={question.status === null && getPrecheckedSupports(precheck).length > 0}
        question={question}
      />
    </StepForm>
  );
}

export type ProfileStepState = {
  onConditions: (picks: string[]) => void;
  precheck: readonly string[];
  progress: { current: number; total: number } | null;
};

/** The conditions' picks stay in this run's state only, to check rows on the supports screen next. */
export function useProfileStepState(state: FlowState): ProfileStepState {
  const [conditionPicks, setConditionPicks] = useState<string[]>([]);

  return {
    onConditions: setConditionPicks,
    precheck:
      state.current === "learningSupport" && state.history.at(-1) === "conditions"
        ? conditionPicks
        : [],
    progress: getProfileProgress(state),
  };
}

export function ProfileStepScreen({
  lessonHref,
  onAnswer,
  onConditions,
  pending,
  precheck,
  progress,
  step,
  view,
}: ProfileStepState & {
  lessonHref: string | null;
  onAnswer: (input: OnboardingAnswerInput) => Promise<boolean>;
  pending: boolean;
  step: ProfileQuestionView["id"];
  view: OnboardingView;
}) {
  const question = view.profile.questions.find((item) => item.id === step);

  return (
    question &&
    progress && (
      <ProfileStep
        jobPrefill={getString(view.goal.details, "role")}
        lessonHref={lessonHref}
        memoryEnabled={view.profile.memoryEnabled}
        nextIsSupport={view.steps[view.steps.indexOf(step) + 1] === "learningSupport"}
        onAnswer={onAnswer}
        onConditions={onConditions}
        pending={pending}
        precheck={precheck}
        progress={progress}
        question={question}
      />
    )
  );
}
