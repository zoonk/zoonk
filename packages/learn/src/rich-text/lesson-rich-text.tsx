import { toOneLine } from "@zoonk/utils/math-spans";
import { useAppLocale } from "../_utils/locale";
import { RichInlineSegments } from "./rich-inline-segments";
import { typesetLessonText } from "./rich-text-blocks";
import { markRichInline, parseRichInline } from "./rich-text-parser";

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
    <RichInlineSegments
      segments={literalNumbers ? segments : typesetLessonText({ locale, segments })}
    />
  );
}
