"use client";

import { type MaterialCitation } from "@zoonk/core/library/sources/material-question-contract";
import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { Textarea } from "@zoonk/ui/components/textarea";
import { ArrowUpIcon, FileTextIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { useId, useState, useTransition } from "react";
import { usePrimaryVariant } from "../../_utils/fun-primary";
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
import { TypedGoal } from "./goal-outcomes";

const MAX_QUESTION_LENGTH = 500;

type Turn = { id: string; outcome: MaterialQuestionOutcome; question: string };

function useCitationLabel() {
  const t = useExtracted();

  return ({ page, title, unit }: MaterialCitation): string => {
    if (page === null) {
      return title;
    }

    return unit === "slide"
      ? t("{title}, slide {page}", { page: String(page), title })
      : t("{title}, page {page}", { page: String(page), title });
  };
}

/** The answer to one question, with the pages it came from, or why there's no answer. */
function TurnAnswer({ outcome }: { outcome: MaterialQuestionOutcome }) {
  const t = useExtracted();
  const toLabel = useCitationLabel();

  if (outcome.status !== "answered") {
    const messages: Record<Exclude<MaterialQuestionOutcome["status"], "answered">, string> = {
      failed: t("We couldn't answer that. Try again in a moment."),
      limitReached: t("You've asked as many questions as your plan allows today."),
      signInRequired: t("Create an account to ask about your material."),
    };

    return <p className="text-destructive text-sm">{messages[outcome.status]}</p>;
  }

  const { answer, citations } = outcome.answer;

  return (
    <div className="bg-card ring-foreground/10 in-data-[mode=fun]:fun-glass flex flex-col gap-3 rounded-3xl p-4 ring-1">
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
  );
}

/**
 * "Ask questions" about the material the learner attached: each answer comes from their pages
 * and shows the page it came from, so they can read it there.
 */
export function MaterialQuestions({
  ask,
  sources,
}: {
  ask: OnboardingActions["askMaterial"];
  sources: AttachedSource[];
}) {
  const t = useExtracted();
  const locale = useLocale();
  const primaryVariant = usePrimaryVariant();
  const inputId = useId();
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [isPending, startTransition] = useTransition();
  const trimmed = question.trim();

  const submit = () => {
    if (!trimmed || isPending) {
      return;
    }

    setQuestion("");

    startTransition(async () => {
      const outcome = await ask({
        language: locale,
        question: trimmed,
        sourceIds: sources.map((source) => source.id),
      });

      setTurns((previous) => [
        ...previous,
        { id: crypto.randomUUID(), outcome, question: trimmed },
      ]);
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
          <div className="flex flex-col gap-3" key={turn.id}>
            <TypedGoal goal={turn.question} />
            <TurnAnswer outcome={turn.outcome} />
          </div>
        ))}

        {isPending && (
          <p className="flex items-center gap-2 text-sm" role="status">
            <Spinner className="size-4" />
            {t("Reading your material…")}
          </p>
        )}
      </div>

      <form
        className="bg-muted/60 in-data-[mode=fun]:fun-glass focus-within:ring-ring/40 mt-auto flex items-end gap-2 rounded-3xl p-2 pl-4 focus-within:ring-[3px]"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label className="sr-only" htmlFor={inputId}>
          {t("Your question")}
        </label>
        <Textarea
          autoFocus
          className="field-sizing-content max-h-40 min-h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          id={inputId}
          maxLength={MAX_QUESTION_LENGTH}
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
          className="size-11 shrink-0 rounded-full"
          disabled={!trimmed || isPending}
          size="icon-lg"
          type="submit"
          variant={primaryVariant}
        >
          <ArrowUpIcon aria-hidden="true" className="size-5" />
        </Button>
      </form>
    </OnboardingColumn>
  );
}
