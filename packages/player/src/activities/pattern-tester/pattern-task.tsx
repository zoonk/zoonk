import { RichInlineSegments } from "@zoonk/learn/rich-text/inline";
import { parseRichInline } from "@zoonk/learn/rich-text/parser";
import { toOneLine } from "@zoonk/utils/math-spans";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { keyedByPosition } from "../_utils/position-keys";

const IDENTIFIER = /\d+(?:-\d+)+/u;
const IDENTIFIER_PARTS = new RegExp(`(?<identifier>${IDENTIFIER.source})`, "u");

export function PatternTask({ literalNumbers, text }: { literalNumbers: boolean; text: string }) {
  if (!literalNumbers) {
    return <LessonRichText text={text} />;
  }

  const segments = keyedByPosition(
    parseRichInline(toOneLine(text)),
    (segment) => `${segment.kind}-${segment.text}`,
  );

  return (
    <span>
      {segments.flatMap(({ item: segment, key }) => {
        if (segment.kind === "math" || segment.kind === "displayMath") {
          return <RichInlineSegments key={key} segments={[segment]} />;
        }

        return keyedByPosition(segment.text.split(IDENTIFIER_PARTS), (part) => part).map(
          ({ item: part, key: partKey }) => (
            <span
              className={IDENTIFIER.test(part) ? "whitespace-nowrap" : undefined}
              key={`${key}-${partKey}`}
            >
              <RichInlineSegments segments={[{ ...segment, text: part }]} />
            </span>
          ),
        );
      })}
    </span>
  );
}
