"use client";

import { type SpeakingCard as SpeakingCardData } from "@zoonk/core/language/exam-speaking/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { RichTable } from "../../_components/rich-table";
import { SURFACE_CLASS } from "../../_components/surface";

/** Task photos are drawn landscape, as an exam's sheet prints them. */
const PHOTO_WIDTH = 1536;
const PHOTO_HEIGHT = 1024;

function CardPhoto({
  compact,
  photo,
}: {
  compact: boolean;
  photo: SpeakingCardData["photos"][number];
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return null;
  }

  return (
    // oxlint-disable-next-line next/no-img-element -- @zoonk/learn doesn't depend on next/image; task photos are stored, optimized webp files.
    <img
      alt={photo.alt}
      className={cn(
        "bg-muted/40 h-auto w-full rounded-xl object-cover",
        compact && "max-h-40 sm:max-h-56",
      )}
      decoding="async"
      height={PHOTO_HEIGHT}
      onError={() => setFailed(true)}
      src={photo.url}
      width={PHOTO_WIDTH}
    />
  );
}

function CardText({
  compact,
  text,
}: {
  compact: boolean;
  text: NonNullable<SpeakingCardData["text"]>;
}) {
  return (
    <article
      className={cn(
        "bg-muted/40 flex flex-col gap-2 rounded-xl p-4 text-sm leading-6",
        compact &&
          "focus-visible:ring-ring/50 max-h-56 overflow-y-auto outline-none focus-visible:ring-[3px]",
      )}
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- A text that scrolls in its box needs focus by keyboard.
      tabIndex={compact ? 0 : undefined}
    >
      <h3 className="font-semibold text-balance">{text.title}</h3>
      {text.body.split(/\n\s*\n/u).map((paragraph) => (
        <p className="text-pretty" key={paragraph}>
          {paragraph}
        </p>
      ))}
    </article>
  );
}

function CardTable({ table }: { table: NonNullable<SpeakingCardData["table"]> }) {
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm font-medium text-pretty">{table.title}</figcaption>
      <RichTable
        align={table.columns.map(() => "left")}
        header={table.columns}
        label={table.title}
        renderCell={(cell) => cell}
        rows={table.rows}
      />
    </figure>
  );
}

/**
 * An exam task's card as the candidate gets it, in the exam's language: the instructions, the
 * points or questions it lists, and the material it works from (photos, a text or figures). It
 * stays on screen through the call, as the sheet stays on the table in the exam; there it's
 * `compact` (photos side by side and lower, a long text scrolling in its box), so what was said
 * stays close on a phone.
 */
export function SpeakingCard({
  card,
  className,
  compact = false,
  language,
}: {
  card: SpeakingCardData;
  className?: string;
  compact?: boolean;
  /** The exam's language, for screen readers and hyphenation. */
  language: string;
}) {
  const t = useExtracted();

  return (
    <section
      aria-label={t("Your card")}
      className={cn(SURFACE_CLASS, "flex flex-col gap-4 p-4 sm:p-5", className)}
      data-slot="speaking-card"
      lang={language}
    >
      <div className="flex flex-col gap-1.5">
        {card.instructions.map((line) => (
          <p className="font-medium text-pretty" key={line}>
            {line}
          </p>
        ))}
      </div>

      {card.photos.length > 0 && (
        <div
          className={cn(
            "grid gap-2",
            card.photos.length > 1 && (compact ? "grid-cols-2" : "sm:grid-cols-2"),
          )}
        >
          {card.photos.map((photo) => (
            <CardPhoto compact={compact} key={photo.url} photo={photo} />
          ))}
        </div>
      )}

      {card.text && <CardText compact={compact} text={card.text} />}
      {card.table && <CardTable table={card.table} />}

      {card.prompts.length > 0 && (
        <ul className="flex list-disc flex-col gap-1.5 ps-5 text-sm leading-5">
          {card.prompts.map((prompt) => (
            <li className="text-pretty" key={prompt}>
              {prompt}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
