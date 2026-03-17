"use client";

import { InputGroup, InputGroupInput } from "@zoonk/ui/components/input-group";
import { Label } from "@zoonk/ui/components/label";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";

const PROMPT_MAX_LENGTH = 128;
const CYCLE_DURATION_MS = 3200;

export function LearnForm({ placeholders }: { placeholders: string[] }) {
  const t = useExtracted();
  const queryId = useId();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("query");
    const query = typeof value === "string" ? value : "";

    if (!query.trim()) {
      return;
    }

    startTransition(() => {
      router.push(`/learn/${encodeURIComponent(query.trim())}`);
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
      </InputGroup>
    </form>
  );
}
