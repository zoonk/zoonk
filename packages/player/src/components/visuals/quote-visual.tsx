import { type QuoteVisualContent } from "@zoonk/core/steps/visual-content-contract";

export function QuoteVisual({ content }: { content: QuoteVisualContent }) {
  return (
    <figure className="flex w-full max-w-xl flex-col items-center gap-4 px-6 text-center sm:gap-5 sm:px-8">
      <blockquote>
        <p className="text-2xl leading-relaxed font-normal tracking-tight italic sm:text-3xl sm:leading-relaxed">
          {content.text}
        </p>
      </blockquote>

      <figcaption className="text-muted-foreground text-sm font-medium">
        — {content.author}
      </figcaption>
    </figure>
  );
}
