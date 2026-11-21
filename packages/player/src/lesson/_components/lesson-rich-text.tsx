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

type LessonRichLineProps = { literalNumbers?: boolean; mark?: string | null; text: string };

/** Lesson text on one line, such as a quote of it: a code block in it reads as one run of code. */
export function LessonRichLine({ literalNumbers = false, mark, text }: LessonRichLineProps) {
  const locale = useAppLocale();
  const parsed = parseRichLine({ parseProse: (prose) => parseRichInline(toOneLine(prose)), text });
  const segments = mark ? markRichInline(parsed, mark) : parsed;

  return (
    <RichInlineSegments segments={literalNumbers ? segments : typeset({ locale, segments })} />
  );
}

/** A text that is one code block, such as an option that is a program, shows as code. */
export function LessonRichText(props: LessonRichLineProps) {
  const code = readWholeCodeFence(props.text);

  if (code) {
    return <CodeSnippet code={code.code} language={code.language} />;
  }

  return <LessonRichLine {...props} />;
}
