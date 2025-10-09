"use client";

import { ArrowUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { Activity, type FormEvent, useId, useState } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useRouter } from "@/i18n/navigation";

export function StartCourseForm() {
  const [isLoading, setIsLoading] = useState(false);
  const t = useTranslations("Learn");
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
      push(`/learn/${encodedQuery}`);
    }
  };

  return (
    <form
      onSubmit={submitForm}
      className="w-full"
      aria-labelledby="learn-title"
    >
      <Label htmlFor={queryId} className="sr-only">
        {t("label")}
      </Label>

      <InputGroup className="h-12">
        <InputGroupInput
          name="query"
          id={queryId}
          autoFocus
          placeholder={t("placeholder")}
          required
          className="peer"
          disabled={isLoading}
        />

        <InputGroupAddon
          align="inline-end"
          className="opacity-0 transition-all duration-200 ease-in-out peer-[&:not(:placeholder-shown)]:opacity-100"
        >
          <Activity mode={isLoading ? "visible" : "hidden"}>
            <Spinner />
          </Activity>

          <InputGroupButton
            type="submit"
            variant="default"
            size="icon-xs"
            className="rounded-full"
            aria-label={t("submit")}
            disabled={isLoading}
          >
            <ArrowUp aria-hidden="true" />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
