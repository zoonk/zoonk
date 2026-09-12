"use client";

import { runClientAction } from "@/lib/client-action";
import { trackLearnForm } from "@/lib/track-events";
import { CyclingText } from "@zoonk/ui/components/cycling-text";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@zoonk/ui/components/input-group";
import { Label } from "@zoonk/ui/components/label";
import { Spinner } from "@zoonk/ui/components/spinner";
import { ArrowUpIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { LEARN_TITLE_ID } from "./learn-title";
import { learningRequestAction } from "./learning-request-action";
import { readLearningRequestDraft, saveLearningRequestDraft } from "./learning-request-draft";
import { LearningRequestFeedback } from "./learning-request-feedback";

export function LearnForm({
  placeholders,
  suggestions,
}: {
  placeholders: string[];
  suggestions: string[];
}) {
  const t = useExtracted();
  const language = useLocale();
  const queryId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<Awaited<ReturnType<typeof learningRequestAction>>>();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    trackLearnForm();
    // oxlint-disable-next-line react/set-state-in-effect -- Restore the browser session draft after hydration; server rendering cannot access sessionStorage.
    setQuery(readLearningRequestDraft());
  }, []);

  function updateQuery(value: string) {
    setQuery(value);
    saveLearningRequestDraft(value);
    setResult(undefined);
  }

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!query.trim()) {
      return;
    }

    startTransition(async () =>
      setResult(
        await runClientAction(() => learningRequestAction({ language, prompt: query.trim() }), {
          status: "unavailable" as const,
        }),
      ),
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <form
        aria-labelledby={LEARN_TITLE_ID}
        className="flex w-full flex-col gap-4"
        onSubmit={handleSubmit}
      >
        <Label className="sr-only" htmlFor={queryId}>
          {t("What do you want to learn?")}
        </Label>
        <InputGroup className="bg-muted/50 h-14">
          <div className="relative flex min-w-0 flex-1">
            <InputGroupInput
              autoFocus
              className="peer"
              disabled={isPending}
              id={queryId}
              maxLength={8000}
              name="query"
              onChange={(event) => updateQuery(event.target.value)}
              placeholder=" "
              ref={inputRef}
              required
              value={query}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-2 left-3 flex items-center overflow-hidden transition-opacity duration-200 peer-not-placeholder-shown:opacity-0"
            >
              <CyclingText className="text-muted-foreground absolute text-sm whitespace-nowrap">
                {placeholders}
              </CyclingText>
            </div>
          </div>
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              aria-busy={isPending}
              aria-label={t("Find my next step")}
              className="size-11"
              disabled={isPending}
              size="icon-sm"
              type="submit"
              variant="default"
            >
              {isPending ? <Spinner aria-hidden="true" /> : <ArrowUpIcon aria-hidden="true" />}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        {isPending && (
          <p className="text-muted-foreground text-center text-sm" role="status">
            {t("Finding a useful place to start…")}
          </p>
        )}
        <LearningRequestFeedback status={result?.status} />
      </form>
      <nav
        aria-label={t("Suggested subjects")}
        className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1"
      >
        {suggestions.map((subject) => (
          <button
            className="text-muted-foreground hover:text-foreground min-h-11 text-sm underline-offset-4 hover:underline"
            disabled={isPending}
            key={subject}
            onClick={() => {
              updateQuery(subject);
              inputRef.current?.focus();
            }}
            type="button"
          >
            {subject}
          </button>
        ))}
      </nav>
    </div>
  );
}
