"use client";

import { RichInlineSegments } from "@zoonk/learn/rich-text/inline";
import { parseRichInline } from "@zoonk/learn/rich-text/parser";
import { stripWrappingQuotes } from "@zoonk/utils/string";

export function PlayerRichText({ text }: { text: string }) {
  return <RichInlineSegments segments={parseRichInline(stripWrappingQuotes(text))} />;
}
