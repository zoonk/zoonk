import { type CatalogString } from "../strings.mts";
import { type Rule } from "./shared.mts";

/**
 * Catalog wording checks. `allowed` is where the
 * string may stay: the web's strings by the sources that use them, Apple's and Android's by their
 * catalog's file, since those list no sources. `allowedNote` lets a string through by what its
 * translator note says about who sees it.
 */
type CatalogRule = Rule & { allowed?: RegExp; allowedNote?: RegExp; id: string; text: RegExp };

const COMPARES_PLANS =
  /(?:^|\/)(?:pricing|subscription|subscribe)[^/]*(?:\/|$)|Subscriptions\.xcstrings$|strings_subscription\.xml$/u;

export const CATALOG_RULES = [
  {
    id: "subscribe",
    name: 'Paying isn\'t "Subscribe"',
    question:
      'An action that leads to paying reads "Subscribe", and a sentence says "subscribe": never "See Plus", "See plans", "Get Plus" or "Upgrade".',
    role: "design",
    text: /\b(?:see plus|see plans|get plus|try plus|go plus|view plans|upgrade)\b/iu,
  },
  {
    allowed: COMPARES_PLANS,
    allowedNote: /\bsubscribers\b/iu,
    id: "planName",
    name: "Plan's name outside pricing",
    question:
      "Learners don't know what Plus is. A paid feature looks like any other (no badge, no card announcing it) and its gate says \"Subscribe\"; the plan's name appears only where plans are compared (pricing, the subscription page), or in a string whose translator note says only subscribers see it.",
    role: "design",
    text: /\bPlus\b(?! sign)/u,
  },
  {
    id: "noneOption",
    name: "None option beside Skip",
    question:
      'Skip is the "none" answer: a step that has Skip doesn\'t also offer "None of these" or "Nothing to add".',
    role: "design",
    text: /^(?:none of (?:these|the above)|nothing (?:to add|else))\.?$/iu,
  },
] as const satisfies readonly CatalogRule[];

export type CatalogRuleId = (typeof CATALOG_RULES)[number]["id"];

export const SWITCHED_ON: Record<"web" | "apple" | "android", CatalogRuleId[]> = {
  android: [],
  apple: [],
  web: CATALOG_RULES.map(({ id }) => id),
};

function allowedHere(rule: CatalogRule, path: string, string: CatalogString) {
  if (rule.allowedNote?.test(string.note)) {
    return true;
  }

  if (!rule.allowed) {
    return false;
  }

  return string.sources.length > 0
    ? string.sources.every((source) => rule.allowed?.test(source))
    : rule.allowed.test(path);
}

export function catalogRulesBroken(path: string, string: CatalogString): CatalogRule[] {
  return CATALOG_RULES.filter(
    (rule: CatalogRule) => rule.text.test(string.text) && !allowedHere(rule, path, string),
  );
}
