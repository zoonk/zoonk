import { CodeSnippet } from "@zoonk/learn/code";
import { useAppLocale } from "@zoonk/learn/locale";
import { type RichInlineSegment, RichInlineSegments } from "@zoonk/learn/rich-text/inline";
import { markRichInline, parseRichInline, parseRichLine } from "@zoonk/learn/rich-text/parser";
import { typesetNumbers, typesetProse } from "@zoonk/learn/rich-text/typography";
import { readWholeCodeFence } from "@zoonk/utils/code-fence";
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
  const code = readWholeCodeFence(text);

  if (code) {
    return <CodeSnippet code={code.code} language={code.language} />;
  }

  const parsed = parseRichLine({ parseProse: (prose) => parseRichInline(toOneLine(prose)), text });
  const segments = mark ? markRichInline(parsed, mark) : parsed;

  return (
    <RichInlineSegments segments={literalNumbers ? segments : typeset({ locale, segments })} />
  );
}
