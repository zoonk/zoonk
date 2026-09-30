"use client";

import { type SourceCitation } from "@zoonk/core/library/sources/source-citation";
import { Button } from "@zoonk/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@zoonk/ui/components/popover";
import { BookOpenCheckIcon, ExternalLinkIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";

/**
 * "Sources · Checked Sep 2026": the public document a screen or a question comes from (a law, an
 * exam notice), with when it was last checked. It opens the document's title, publisher and link.
 */
export function SourcesChip({ citation }: { citation: SourceCitation }) {
  const t = useExtracted();
  const format = useFormatter();
  const month = format.dateTime(citation.checkedAt, { month: "short", year: "numeric" });
  const day = format.dateTime(citation.checkedAt, { dateStyle: "medium" });

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button className="text-muted-foreground" size="xs" type="button" variant="outline" />
        }
      >
        <BookOpenCheckIcon aria-hidden="true" data-icon="inline-start" />
        {t("Sources · Checked {date}", { date: month })}
      </PopoverTrigger>

      <PopoverContent align="start" className="gap-3">
        <PopoverHeader>
          <PopoverTitle>{citation.title}</PopoverTitle>
          <PopoverDescription>
            {citation.publisher
              ? t("{publisher} · Checked {date}", { date: day, publisher: citation.publisher })
              : t("Checked {date}", { date: day })}
          </PopoverDescription>
        </PopoverHeader>

        {citation.url && (
          <a
            className="inline-flex w-fit items-center gap-1.5 font-medium underline underline-offset-4"
            href={citation.url}
            rel="noopener noreferrer"
            target="_blank"
          >
            {t("Open the source")}
            <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
          </a>
        )}
      </PopoverContent>
    </Popover>
  );
}
