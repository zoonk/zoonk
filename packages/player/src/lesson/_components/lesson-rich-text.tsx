import { type RichInlineSegment, RichInlineSegments } from "@zoonk/learn/rich-text/inline";
import { markRichInline, parseRichInline, toOneLine } from "@zoonk/learn/rich-text/parser";
import { typesetNumbers } from "@zoonk/learn/rich-text/typography";
import { useLocale } from "next-intl";

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

export function LessonRichText({ mark, text }: { mark?: string | null; text: string }) {
  const locale = useLocale();
  const parsed = parseRichInline(toOneLine(text));
  const segments = mark ? markRichInline(parsed, mark) : parsed;

  return <RichInlineSegments segments={typeset({ locale, segments })} />;
}
