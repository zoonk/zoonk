import { type WritingEvidence } from "@zoonk/ai/tasks/grading/grade-essay";
import { type z } from "zod";
import { type writingZeroKindSchema } from "../../../library/exams/written-grading";
import { type writtenItemSchema } from "../writing-contract";
import { WRITING_LINE_BREAK, estimateWritingLines } from "../writing-lines";

type Basis = z.infer<typeof writtenItemSchema>;
type ZeroKind = z.infer<typeof writingZeroKindSchema>;
type Rule = Basis["grading"]["zeroing"][number];

const IDENTITY_PLACEHOLDER =
  /\b(?:advogado|candidate|candidato|exemplo|fulano|name|nome|placeholder)\b/iu;

const IDENTITY =
  /^(?:assinado por|assinatura\s*:|meu nome [ée]|signed by|signature\s*:|my name is)\s+(?<name>\p{L}+(?:\s+\p{L}+)+)[.!]?$/iu;

const TEXT_VERIFIED_ZEROS: ReadonlySet<ZeroKind> = new Set([
  "blank",
  "copiedSupport",
  "identification",
  "tooFewLines",
]);

export function isTextVerifiedWritingZero(kind: ZeroKind | null | undefined): boolean {
  return kind ? TEXT_VERIFIED_ZEROS.has(kind) : false;
}

function originalText(text: string, quote: string) {
  const start = text.indexOf(quote);

  if (start === -1 || text.includes(quote, start + 1)) {
    return null;
  }

  const before = text.slice(0, start);
  const after = text.slice(start + quote.length);

  if (
    before.split(WRITING_LINE_BREAK).at(-1)?.trim() ||
    after.split(WRITING_LINE_BREAK)[0]?.trim()
  ) {
    return null;
  }

  return `${before}${after}`.trim();
}

function shortEnough(text: string, maxLines: number | null | undefined, basis: Basis) {
  return (
    typeof maxLines === "number" &&
    estimateWritingLines({ charactersPerLine: basis.charactersPerLine, text: text.trim() }) <=
      maxLines
  );
}

function matchesNominatedRule({
  basis,
  context,
  maxLines,
  onTopicQuote,
  text,
  zeroKind,
  zeroQuote,
}: {
  basis: Basis;
  context: string | null;
  maxLines: Rule["maxLines"];
  onTopicQuote: string | null;
  text: string;
  zeroKind: NonNullable<WritingEvidence["zeroKind"]>;
  zeroQuote: string;
}) {
  switch (zeroKind) {
    case "copiedSupport": {
      const original = context?.includes(zeroQuote) ? originalText(text, zeroQuote) : null;
      return original !== null && shortEnough(original, maxLines, basis);
    }
    case "identification": {
      const name = IDENTITY.exec(zeroQuote)?.groups?.name;

      return Boolean(
        name &&
        !IDENTITY_PLACEHOLDER.test(name) &&
        !context?.includes(name) &&
        text.split(WRITING_LINE_BREAK).some((line) => line.trim() === zeroQuote),
      );
    }
    case "offTopic":
      return !(onTopicQuote?.trim() && text.includes(onTopicQuote));
    case "wrongForm":
      return true;
    default:
      return false;
  }
}

function matchesRule({
  basis,
  context,
  evidence,
  rule,
  text,
}: {
  basis: Basis;
  context: string | null;
  evidence: WritingEvidence;
  rule: Rule;
  text: string;
}): ZeroKind | null {
  const { kinds, maxLines } = rule;

  if (kinds?.includes("blank") && text.trim() === "") {
    return "blank";
  }

  if (kinds?.includes("tooFewLines") && shortEnough(text, maxLines, basis)) {
    return "tooFewLines";
  }

  const { onTopicQuote, zeroKind, zeroQuote } = evidence;

  if (!zeroKind || !kinds?.includes(zeroKind) || !zeroQuote?.trim() || !text.includes(zeroQuote)) {
    return null;
  }

  const matches = matchesNominatedRule({
    basis,
    context,
    maxLines,
    onTopicQuote,
    text,
    zeroKind,
    zeroQuote,
  });

  return matches ? zeroKind : null;
}

export function verifiedWritingZero({
  basis,
  context,
  eligible,
  evidence,
}: {
  basis: Basis;
  context: string | null;
  eligible: string;
  evidence: WritingEvidence;
}) {
  for (const rule of basis.grading.zeroing) {
    const kind = matchesRule({ basis, context, evidence, rule, text: eligible });

    if (kind) {
      return { kind, reason: rule.text };
    }
  }

  return null;
}
