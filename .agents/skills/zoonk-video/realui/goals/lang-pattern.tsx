// The mistake pattern screen (/pattern/[patternId]) before its drill, from story.language.pattern.
import { LanguagePatternScreen } from "@repo/packages/learn/src/language/pattern/language-pattern-screen.tsx";
import { story, type Lang } from "../story";
import { LangLearn } from "./lang-frame";
import { NOOP_ASYNC } from "./shell";

export function patternView(lang: Lang) {
  const pattern = story[lang].language.pattern;

  return {
    contrast: pattern.rows.map(([head, meaning, example]) => ({
      example,
      label: `${head} ${meaning}`,
    })),
    // Not shown before the drill starts; one question keeps it a pattern rather than typos.
    drill: [
      {
        answer: pattern.right,
        feedback: pattern.rule,
        options: [pattern.wrong, pattern.right],
        sentence: "",
      },
    ],
    examples: [{ answer: pattern.wrong, correctAnswer: pattern.right, format: "spoken" }],
    id: "00000000-0000-4000-8000-000000000002",
    kind: "pattern",
    occurrences: pattern.times,
    practiced: false,
    rule: pattern.rule,
    title: pattern.title,
  } as any;
}

export function Pattern({ lang }: { lang: Lang }) {
  return (
    <LangLearn>
      <LanguagePatternScreen
        actions={{ dismiss: NOOP_ASYNC, practice: NOOP_ASYNC }}
        buddy={null}
        exitHref="/today"
        pattern={patternView(lang)}
      />
    </LangLearn>
  );
}
