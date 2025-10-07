"use client";

import { ArrowUp } from "lucide-react";
import { useTranslations } from "next-intl";
import type { FormEvent } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { useRouter } from "@/i18n/navigation";

export function StartCourseForm() {
  const t = useTranslations("Learn");
  const { push } = useRouter();

  const submitForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const query = formData.get("query")?.toString().trim();

    if (query) {
      const encodedQuery = encodeURIComponent(query);
      push(`/learn/${encodedQuery}`);
    }
  };

  return (
    <form onSubmit={submitForm} className="w-full">
      <InputGroup className="h-12">
        <InputGroupInput
          name="query"
          autoFocus
          placeholder={t("placeholder")}
          required
          className="peer"
        />

        <InputGroupAddon
          align="inline-end"
          className="opacity-0 transition-all duration-200 ease-in-out peer-[&:not(:placeholder-shown)]:opacity-100"
        >
          <InputGroupButton
            variant="default"
            size="icon-xs"
            className="rounded-full"
          >
            <ArrowUp />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
