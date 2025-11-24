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
import { useId } from "react";
import { useFormStatus } from "react-dom";
import { learnFormAction } from "./actions";

const PROMPT_MAX_LENGTH = 128;

function SubmitForm() {
  const { pending } = useFormStatus();
  const t = useExtracted();

  return (
    <InputGroupAddon
      align="inline-end"
      className="opacity-0 transition-all duration-200 ease-in-out peer-not-placeholder-shown:opacity-100"
    >
      {pending && <Spinner />}

      <InputGroupButton
        aria-label={t("Start")}
        className="rounded-full"
        disabled={pending}
        size="icon-xs"
        type="submit"
        variant="default"
      >
        <ArrowUp aria-hidden="true" />
      </InputGroupButton>
    </InputGroupAddon>
  );
}

export function LearnForm() {
  const t = useExtracted();
  const queryId = useId();

  return (
    <form
      action={learnFormAction}
      aria-labelledby="learn-title"
      className="w-full"
    >
      <Label className="sr-only" htmlFor={queryId}>
        {t("Enter a subject")}
      </Label>

      <InputGroup className="h-12">
        <InputGroupInput
          autoFocus
          className="peer"
          id={queryId}
          maxLength={PROMPT_MAX_LENGTH}
          name="query"
          placeholder={t("e.g., computer science, astronomy, biology, ...")}
          required
        />

        <SubmitForm />
      </InputGroup>
    </form>
  );
}
