"use client";

import { type ItemCitation } from "@zoonk/core/library/sources/source-citation";
import { cn } from "@zoonk/ui/lib/utils";
import { SourcesChip } from "./sources-chip";

/**
 * The passage a question quotes, such as "Lei nº 8.112, Art. 13", and, when its document is
 * stored, the dated Sources chip. Legal content always names the article and the law.
 */
export function ItemCitationNote({
  citation,
  className,
}: {
  citation: ItemCitation;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-sm",
        className,
      )}
    >
      <span className="font-medium">{citation.text}</span>
      {citation.checkedAt && (
        <SourcesChip
          citation={{
            checkedAt: citation.checkedAt,
            publisher: citation.publisher,
            title: citation.title ?? citation.text,
            url: citation.url,
          }}
        />
      )}
    </div>
  );
}
