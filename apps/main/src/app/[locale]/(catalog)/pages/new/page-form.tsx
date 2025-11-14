"use client";

import { InputError } from "@zoonk/ui/components/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@zoonk/ui/components/input-group";
import { Label } from "@zoonk/ui/components/label";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { toSlug } from "@zoonk/utils/validation";
import { useExtracted } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { type CreatePageState, createPageAction } from "./actions";

const initialState: CreatePageState = {
  status: "idle",
};

export function PageForm() {
  const t = useExtracted();
  const router = useRouter();
  const [state, formAction] = useActionState(createPageAction, initialState);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  // Auto-generate slug from name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    // Only auto-generate if user hasn't manually edited the slug
    if (!slug || slug === toSlug(name)) {
      setSlug(toSlug(newName));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlug(toSlug(e.target.value));
  };

  // Redirect on success
  useEffect(() => {
    if (state.status === "success" && state.slug) {
      router.push(`/p/${state.slug}`);
    }
  }, [state.status, state.slug, router]);

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t("Page name")}</Label>
        <InputGroup>
          <InputGroupInput
            id="name"
            name="name"
            onChange={handleNameChange}
            placeholder={t("My Company")}
            required
            type="text"
            value={name}
          />
        </InputGroup>
        <p className="text-muted-foreground text-sm">
          {t("The name of your business or organization")}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="slug">{t("Page URL")}</Label>
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <InputGroupText>zoonk.com/p/</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            id="slug"
            name="slug"
            onChange={handleSlugChange}
            placeholder={t("my-company")}
            required
            type="text"
            value={slug}
          />
        </InputGroup>
        <p className="text-muted-foreground text-sm">
          {t("This will appear in the link:")} zoonk.com/p/{slug || "your-page"}
        </p>
      </div>

      {state.status === "error" && state.message && (
        <InputError>{state.message}</InputError>
      )}

      <div>
        <SubmitButton>{t("Create page")}</SubmitButton>
      </div>
    </form>
  );
}
