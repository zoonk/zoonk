"use client";

import { CodeSnippet } from "@zoonk/learn/code";
import { RichInlineSegments } from "@zoonk/learn/rich-text/inline";
import { parseRichInline, parseRichLine, readWholeCodeBlock } from "@zoonk/learn/rich-text/parser";
import { stripWrappingQuotes } from "@zoonk/utils/string";

export function PlayerRichText({ text }: { text: string }) {
  const code = readWholeCodeBlock(text);

  if (code) {
    return <CodeSnippet code={code.code} language={code.language} />;
  }

  return (
    <RichInlineSegments
      segments={parseRichLine({ parseProse: parseRichInline, text: stripWrappingQuotes(text) })}
    />
  );
}
