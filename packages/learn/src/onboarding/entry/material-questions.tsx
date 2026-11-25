"use client";

import { MAX_MATERIAL_QUESTION_LENGTH } from "@zoonk/core/library/sources/material-question-contract";
import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { Textarea } from "@zoonk/ui/components/textarea";
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowUpIcon, FileTextIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { toHelpLimit } from "../../_components/comes-back-words";
import { HelpLimitNotice } from "../../_components/help-limit-notice";
import { SURFACE_CLASS } from "../../_components/surface";
import { useAppLocale } from "../../_utils/locale";
import { useCitationLabel } from "../../_utils/use-citation-label";
import {
  type LearnBuddy,
  type TutorIdentity,
  TutorMessage,
  useTutorIdentity,
} from "../../conversation/tutor-identity";
import { useLearnRoutes } from "../../learn-context";
import { LearnLink } from "../../learn-link";
import {
  type AttachedSource,
  type MaterialQuestionOutcome,
  type OnboardingActions,
} from "../onboarding-actions";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingHeading,
  OnboardingTitle,
} from "../onboarding-frame";
import { GOAL_PANEL_CLASS } from "./goal-field";
import { TypedGoal } from "./goal-outcomes";

const READ_CHECK_MS = 3000;

/** No `outcome` yet while the question waits for the material's reading or for its answer. */
type Turn = { id: string; outcome: MaterialQuestionOutcome | null; question: string };

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Sending is the request: while the material is still being read the server says so before it
 * answers or counts anything, so the question is asked again until it's read. Null once the learner
 * left the screen, so nothing is answered for no one.
 */
function useAskWhenRead(ask: OnboardingActions["askMaterial"]) {
  const screen = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    screen.current = controller;
    return () => controller.abort();
  }, []);

  const askWhenRead = async (
    input: Parameters<typeof ask>[0],
  ): Promise<MaterialQuestionOutcome | null> => {
    const outcome = await ask(input).catch((): MaterialQuestionOutcome => ({ status: "failed" }));

    if (outcome.status !== "reading") {
      return outcome;
    }

    await wait(READ_CHECK_MS);
    return screen.current?.signal.aborted ? null : askWhenRead(input);
  };

  return askWhenRead;
}

function TurnAnswer({
  identity,
  outcome,
}: {
  identity: TutorIdentity;
  outcome: MaterialQuestionOutcome;
}) {
  const t = useExtracted();
  const toLabel = useCitationLabel();
  const routes = useLearnRoutes();

  if (outcome.status === "limitReached") {
    return (
      <TutorMessage identity={identity}>
        <HelpLimitNotice
          kind="questions"
          limit={toHelpLimit(outcome)}
          linkComponent={LearnLink}
          routes={routes}
        />
      </TutorMessage>
    );
  }

  // Never kept: the question waits and is asked again instead.
  if (outcome.status === "reading") {
    return null;
  }

  if (outcome.status !== "answered") {
    const messages: Record<
      Exclude<MaterialQuestionOutcome["status"], "answered" | "limitReached" | "reading">,
      string
    > = {
      failed: t("We couldn't answer that. Try again in a moment."),
      signInRequired: t("Create an account to ask about your material."),
      slowDown: t("You're asking quickly. Try again in a few minutes."),
    };

    return (
      <TutorMessage identity={identity}>
        <p className="text-destructive-text text-sm">{messages[outcome.status]}</p>
      </TutorMessage>
    );
  }

  const { answer, citations } = outcome.answer;

  return (
    <TutorMessage identity={identity}>
      <div className={cn(SURFACE_CLASS, "flex flex-col gap-3 p-4")}>
        <p className="leading-relaxed whitespace-pre-wrap">{answer}</p>

        {citations.length > 0 && (
          <ul aria-label={t("Where this comes from")} className="flex flex-wrap gap-2">
            {citations.map((citation) => (
              <li
                className="bg-muted text-muted-foreground flex items-center gap-1.5 rounded-full px-3 py-1 text-xs"
                key={`${citation.title}-${citation.page}`}
              >
                <FileTextIcon aria-hidden="true" className="size-3.5" />
                {toLabel(citation)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </TutorMessage>
  );
}

export function MaterialQuestions({
  ask,
  buddy,
  sources,
}: {
  ask: OnboardingActions["askMaterial"];
  buddy: LearnBuddy | null | undefined;
  sources: AttachedSource[];
}) {
  const t = useExtracted();
  const locale = useAppLocale();
  const inputId = useId();
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const trimmed = question.trim();
  const identity = useTutorIdentity(buddy);
  const formRef = useRef<HTMLFormElement>(null);
  const askWhenRead = useAskWhenRead(ask);
  const waiting = turns.some((turn) => turn.outcome === null);

  /**
   * What lands above the box (the pending line, an answer) pushes it down while scroll anchoring holds
   * the transcript still, so a learner still typing gets the box back.
   */
  const keepBoxInView = (landed: HTMLElement | null) => {
    const form = formRef.current;

    if (landed && form?.contains(document.activeElement)) {
      form.scrollIntoView({ block: "nearest" });
    }
  };

  const submit = () => {
    if (!trimmed || waiting) {
      return;
    }

    const id = crypto.randomUUID();
    setQuestion("");
    setTurns((previous) => [...previous, { id, outcome: null, question: trimmed }]);

    void askWhenRead({
      language: locale,
      question: trimmed,
      sourceIds: sources.map((source) => source.id),
    }).then((outcome) => {
      if (outcome) {
        setTurns((previous) =>
          previous.map((turn) => (turn.id === id ? { ...turn, outcome } : turn)),
        );
      }
    });
  };

  return (
    <OnboardingColumn>
      <OnboardingHeading>
        <OnboardingTitle>{t("Ask about your material")}</OnboardingTitle>
        <OnboardingDescription>
          {t("Answers come from your pages and show where they came from.")}
        </OnboardingDescription>
      </OnboardingHeading>

      <div aria-live="polite" className="flex flex-col gap-4">
        {turns.map((turn) => (
          <div className="flex flex-col gap-3" key={turn.id} ref={keepBoxInView}>
            <TypedGoal goal={turn.question} />
            {turn.outcome ? (
              <div ref={keepBoxInView}>
                <TurnAnswer identity={identity} outcome={turn.outcome} />
              </div>
            ) : (
              <p className="flex items-center gap-2 text-sm" ref={keepBoxInView} role="status">
                <Spinner className="size-4" />
                {t("Reading your material…")}
              </p>
            )}
          </div>
        ))}
      </div>

      <form
        className={cn(
          GOAL_PANEL_CLASS,
          "mt-auto flex scroll-my-1 items-end gap-2 p-1.5 pl-4 lg:mt-0",
        )}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        ref={formRef}
      >
        <label className="sr-only" htmlFor={inputId}>
          {t({
            description: "Label of the field where the learner types a question.",
            message: "Your question",
          })}
        </label>
        <Textarea
          autoFocus
          className="field-sizing-content max-h-40 min-h-(--control-height) border-0 bg-transparent px-0 py-[calc((var(--control-height)-1lh)/2)] shadow-none focus-visible:ring-0"
          id={inputId}
          maxLength={MAX_MATERIAL_QUESTION_LENGTH}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={t("E.g., why does glycolysis net only 2 ATP?")}
          rows={1}
          value={question}
        />
        <Button
          aria-label={t("Ask")}
          busy={waiting}
          className="shrink-0"
          disabled={!trimmed}
          focusableWhenDisabled
          icon={<ArrowUpIcon aria-hidden="true" className="size-5" />}
          size="icon-lg"
          type="submit"
        />
      </form>
    </OnboardingColumn>
  );
}
