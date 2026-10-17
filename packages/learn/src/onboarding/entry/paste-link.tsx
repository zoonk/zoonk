"use client";

import { Button } from "@zoonk/ui/components/button";
import { Input } from "@zoonk/ui/components/input";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";

/** A page with the learner's material: an article, a class page or a public PDF. */
export function PasteLink({ onAdd, pending }: { onAdd: (url: string) => void; pending: boolean }) {
  const t = useExtracted();
  const inputId = useId();
  const [url, setUrl] = useState("");
  const trimmed = url.trim();

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();

        if (trimmed) {
          onAdd(trimmed);
        }
      }}
    >
      <label className="sr-only" htmlFor={inputId}>
        {t("Link")}
      </label>
      <Input
        autoFocus
        className="h-11"
        id={inputId}
        inputMode="url"
        onChange={(event) => setUrl(event.target.value)}
        placeholder={t("https://… an article, a class page or a PDF")}
        type="url"
        value={url}
      />
      <Button className="self-start" disabled={pending || !trimmed} size="sm" type="submit">
        {t("Add link")}
      </Button>
    </form>
  );
}
