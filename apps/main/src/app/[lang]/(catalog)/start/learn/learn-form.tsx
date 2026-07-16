"use client";

import { useRouter } from "@/i18n/navigation";
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
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowUpIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useId, useTransition } from "react";

const PROMPT_MAX_LENGTH = 128;

/**
 * Owns the interactive course goal input and records the form visibility event
 * from the browser, while submitted prompts still enter the existing
 * `/start/learn/[prompt]` route for server-side routing.
 */
export function LearnForm({ placeholders }: { placeholders: string[] }) {
  const t = useExtracted();
  const queryId = useId();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    trackLearnForm();
  }, []);

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("query");
    const query = typeof value === "string" ? value : "";

    if (!query.trim()) {
      return;
    }

    startTransition(() => {
      router.push(`/start/learn/${encodeURIComponent(query.trim())}`);
    });
  }

  return (
    <form aria-labelledby="learn-title" className="w-full" onSubmit={handleSubmit}>
      <Label className="sr-only" htmlFor={queryId}>
        {t("Enter a subject")}
      </Label>

      <InputGroup
        className={cn(
          "bg-muted/50 h-14 border-transparent",
          "has-[[data-slot=input-group-control]:focus-visible]:border-transparent",
          "has-[[data-slot=input-group-control]:focus-visible]:bg-muted/70",
          "has-[[data-slot=input-group-control]:focus-visible]:shadow-sm",
          "has-[[data-slot=input-group-control]:focus-visible]:ring-0",
        )}
      >
        <div className="relative flex flex-1">
          <InputGroupInput
            autoFocus
            className="peer"
            disabled={isPending}
            id={queryId}
            maxLength={PROMPT_MAX_LENGTH}
            name="query"
            placeholder=" "
            required
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-3 flex items-center transition-opacity duration-200 peer-not-placeholder-shown:opacity-0"
          >
            <CyclingText className="text-muted-foreground absolute text-sm whitespace-nowrap">
              {placeholders}
            </CyclingText>
          </div>
        </div>

        <InputGroupAddon align="inline-end">
          <InputGroupButton
            aria-busy={isPending}
            aria-label={t("Start a course")}
            disabled={isPending}
            size="icon-sm"
            type="submit"
            variant="default"
          >
            {isPending ? <Spinner /> : <ArrowUpIcon aria-hidden="true" />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
