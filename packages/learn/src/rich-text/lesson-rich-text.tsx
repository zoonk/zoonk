import { readWholeCodeFence } from "@zoonk/utils/code-fence";
import { toOneLine } from "@zoonk/utils/math-spans";
import { useAppLocale } from "../_utils/locale";
import { CodeSnippet } from "../code/code-listing";
import { RichInlineSegments } from "./rich-inline-segments";
import { typesetLessonText } from "./rich-text-blocks";
import { markRichInline, parseRichInline, parseRichLine } from "./rich-text-parser";

type LessonRichLineProps = { literalNumbers?: boolean; mark?: string | null; text: string };

/** Lesson text on one line, such as a quote of it: a code block in it reads as one run of code. */
export function LessonRichLine({ literalNumbers = false, mark, text }: LessonRichLineProps) {
  const locale = useAppLocale();
  const parsed = parseRichLine({ parseProse: (prose) => parseRichInline(toOneLine(prose)), text });
  const segments = mark ? markRichInline(parsed, mark) : parsed;

  return (
    <RichInlineSegments
      segments={literalNumbers ? segments : typesetLessonText({ locale, segments })}
    />
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
