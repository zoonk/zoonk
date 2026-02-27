"use client";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@zoonk/ui/components/input-group";
import { Label } from "@zoonk/ui/components/label";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowUp } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { useFormStatus } from "react-dom";
import { learnFormAction } from "./actions";

const PROMPT_MAX_LENGTH = 128;
const CYCLE_DURATION_MS = 3200;

function SubmitForm() {
  const { pending } = useFormStatus();
  const t = useExtracted();

  return (
    <InputGroupAddon
      align="inline-end"
      className="scale-90 opacity-0 transition-all duration-200 ease-in-out peer-not-placeholder-shown:scale-100 peer-not-placeholder-shown:opacity-100"
    >
      <InputGroupButton
        aria-label={t("Start")}
        className="rounded-full"
        disabled={pending}
        size="icon-sm"
        type="submit"
        variant="default"
      >
        {pending ? <Spinner /> : <ArrowUp aria-hidden="true" />}
      </InputGroupButton>
    </InputGroupAddon>
  );
}

export function LearnForm({ placeholders }: { placeholders: string[] }) {
  const t = useExtracted();
  const queryId = useId();

  return (
    <form action={learnFormAction} aria-labelledby="learn-title" className="w-full">
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
            {placeholders.map((subject, index) => (
              <span
                key={subject}
                className="text-muted-foreground animate-placeholder-cycle absolute text-sm whitespace-nowrap"
                style={{ animationDelay: `${index * CYCLE_DURATION_MS}ms` }}
              >
                {subject}
              </span>
            ))}
          </div>
        </div>

        <SubmitForm />
      </InputGroup>
    </form>
  );
}
