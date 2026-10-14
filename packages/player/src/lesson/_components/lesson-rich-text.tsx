import { type RichInlineSegment, RichInlineSegments } from "@zoonk/learn/rich-text/inline";
import { markRichInline, parseRichInline } from "@zoonk/learn/rich-text/parser";
import { typesetNumbers } from "@zoonk/learn/rich-text/typography";
import { useLocale } from "next-intl";

/** Numbers in the learner's language, kept with their units; math and code stay as written. */
function typeset({
  locale,
  segments,
}: {
  locale: string;
  segments: RichInlineSegment[];
}): RichInlineSegment[] {
  return segments.map((segment) =>
    segment.kind === "math" || segment.kind === "displayMath" || segment.kind === "code"
      ? segment
      : { ...segment, text: typesetNumbers({ locale, text: segment.text }) },
  );
}

/**
 * One line of lesson text (a question, an option, a label) with its emphasis and math, and the
 * `mark` sentence highlighted when the line shows it.
 */
export function LessonRichText({ mark, text }: { mark?: string | null; text: string }) {
  const locale = useLocale();
  const parsed = parseRichInline(text.replaceAll(/\s*\n\s*/gu, " "));
  const segments = mark ? markRichInline(parsed, mark) : parsed;

  return <RichInlineSegments segments={typeset({ locale, segments })} />;
}
