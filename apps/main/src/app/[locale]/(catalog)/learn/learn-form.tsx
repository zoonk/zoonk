"use client";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@zoonk/ui/components/input-group";
import { Label } from "@zoonk/ui/components/label";
import { Spinner } from "@zoonk/ui/components/spinner";
import { ArrowUp } from "lucide-react";
import { useExtracted } from "next-intl";
import { type FormEvent, useId, useState } from "react";
import { useRouter } from "@/i18n/navigation";

const PROMPT_MAX_LENGTH = 128;

export function LearnForm() {
  const [isLoading, setIsLoading] = useState(false);
  const t = useExtracted();
  const { push } = useRouter();
  const queryId = useId();

  const submitForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const query = formData.get("query")?.toString().trim();

    if (query) {
      const encodedQuery = encodeURIComponent(query);
      setIsLoading(false);
      push(`/learn/${encodedQuery}`);
      form.reset();
    }
  };

  return (
    <form
      aria-labelledby="learn-title"
      className="w-full"
      onSubmit={submitForm}
    >
      <Label className="sr-only" htmlFor={queryId}>
        {t("Enter a subject")}
      </Label>

      <InputGroup className="h-12">
        <InputGroupInput
          autoFocus
          className="peer"
          disabled={isLoading}
          id={queryId}
          maxLength={PROMPT_MAX_LENGTH}
          name="query"
          placeholder={t("e.g., computer science, astronomy, biology, ...")}
          required
        />

        <InputGroupAddon
          align="inline-end"
          className="opacity-0 transition-all duration-200 ease-in-out peer-not-placeholder-shown:opacity-100"
        >
          {isLoading && <Spinner />}

          <InputGroupButton
            aria-label={t("Start")}
            className="rounded-full"
            disabled={isLoading}
            size="icon-xs"
            type="submit"
            variant="default"
          >
            <ArrowUp aria-hidden="true" />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
