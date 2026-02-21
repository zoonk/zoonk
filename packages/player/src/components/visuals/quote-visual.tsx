"use client";

import {
  type SupportedVisualKind,
  type VisualContentByKind,
  quoteVisualContentSchema,
} from "@zoonk/core/steps/visual-content-contract";

function QuoteMark() {
  return (
    <span
      aria-hidden="true"
      className="text-muted-foreground/20 font-serif text-6xl leading-none select-none"
    >
      &ldquo;
    </span>
  );
}

export function QuoteVisual({ content }: { content: VisualContentByKind[SupportedVisualKind] }) {
  const parsed = quoteVisualContentSchema.parse(content);

  return (
    <figure className="flex w-full max-w-xl flex-col items-center gap-4 px-2 text-center sm:gap-6">
      <QuoteMark />

      <blockquote>
        <p className="text-xl leading-relaxed font-medium tracking-tight sm:text-2xl sm:leading-relaxed">
          {parsed.text}
        </p>
      </blockquote>

      <figcaption className="text-muted-foreground text-sm tracking-wide">
        {parsed.author}
      </figcaption>
    </figure>
  );
}
