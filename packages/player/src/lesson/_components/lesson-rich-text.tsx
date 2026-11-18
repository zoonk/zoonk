import { useAppLocale } from "@zoonk/learn/locale";
import { type RichInlineSegment, RichInlineSegments } from "@zoonk/learn/rich-text/inline";
import { markRichInline, parseRichInline } from "@zoonk/learn/rich-text/parser";
import { typesetNumbers, typesetProse } from "@zoonk/learn/rich-text/typography";
import { toOneLine } from "@zoonk/utils/math-spans";

function typeset({
  locale,
  segments,
}: {
  locale: string;
  segments: RichInlineSegment[];
}): RichInlineSegment[] {
  return typesetProse({ locale, segments, typeset: (text) => typesetNumbers({ locale, text }) });
}

export function LessonRichText({
  literalNumbers = false,
  mark,
  text,
}: {
  literalNumbers?: boolean;
  mark?: string | null;
  text: string;
}) {
  const locale = useAppLocale();
  const parsed = parseRichInline(toOneLine(text));
  const segments = mark ? markRichInline(parsed, mark) : parsed;

  return (
    <RichInlineSegments segments={literalNumbers ? segments : typeset({ locale, segments })} />
  );
}
