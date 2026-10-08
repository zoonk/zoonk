"use client";

import { type MistakePatternView } from "@zoonk/core/language/patterns/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, KeyboardIcon, MicIcon, PenLineIcon, SparklesIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { SectionLabel } from "../../_components/section-label";
import { LanguageCard } from "../language-card";

type PatternExample = MistakePatternView["examples"][number];

function PatternIcon({ kind }: { kind: MistakePatternView["kind"] }) {
  return (
    <span
      aria-hidden="true"
      className="bg-info/10 text-info flex size-12 items-center justify-center rounded-2xl [&_svg]:size-6"
    >
      {kind === "typos" ? <KeyboardIcon /> : <SparklesIcon />}
    </span>
  );
}

/** "since + when it started": the word stands out, what it goes with stays quiet. */
function ContrastLabel({ label }: { label: string }) {
  const [head, ...rest] = label.split(" + ");

  return (
    <span className="min-w-0 flex-1">
      <span className="font-semibold">{head}</span>
      {rest.length > 0 && <span className="text-muted-foreground">{` + ${rest.join(" + ")}`}</span>}
    </span>
  );
}

function ExampleCard({ example, rule }: { example: PatternExample | undefined; rule: string }) {
  const t = useExtracted();

  return (
    <LanguageCard aria-label={t("The rule")} className="gap-1">
      {example && (
        <>
          <p className="text-muted-foreground text-xs font-medium">{t("You said")}</p>
          <p className="text-muted-foreground flex items-start gap-2 text-lg">
            <XIcon aria-hidden="true" className="text-destructive mt-1.5 size-4 shrink-0" />
            <s className="decoration-destructive/50">{example.answer}</s>
          </p>
          <p className="text-muted-foreground mt-2 text-xs font-medium">{t("Correct version")}</p>
          <p className="flex items-start gap-2 text-lg font-semibold">
            <CheckIcon aria-hidden="true" className="text-success mt-1.5 size-4 shrink-0" />
            {example.correctAnswer}
          </p>
        </>
      )}
      <p className={cn("leading-relaxed", example && "mt-3")}>{rule}</p>
    </LanguageCard>
  );
}

function ContrastRows({ contrast }: { contrast: MistakePatternView["contrast"] }) {
  if (contrast.length === 0) {
    return null;
  }

  return (
    <ul className="bg-muted/70 divide-background flex flex-col divide-y rounded-2xl">
      {contrast.map((row) => (
        <li className="flex items-center gap-3 px-4 py-3" key={row.label}>
          <ContrastLabel label={row.label} />
          <span className="shrink-0 tabular-nums">{row.example}</span>
        </li>
      ))}
    </ul>
  );
}

function AlsoCameUp({ examples }: { examples: PatternExample[] }) {
  const t = useExtracted();

  if (examples.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="pattern-also" className="flex flex-col gap-2">
      <SectionLabel id="pattern-also">{t("Also came up in")}</SectionLabel>
      <ul className="text-muted-foreground flex flex-col gap-1.5 text-sm">
        {examples.map((example) => {
          const Icon = example.format.startsWith("spoken") ? MicIcon : PenLineIcon;

          return (
            <li className="flex items-start gap-2" key={example.answer}>
              <Icon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              {t("“{sentence}”", { sentence: example.answer })}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * "We noticed a pattern", with the pattern as its title: one mistake as the example, the rule, the
 * contrast and where else.
 */
export function PatternIntro({ pattern }: { pattern: MistakePatternView }) {
  const t = useExtracted();
  const [first, ...others] = pattern.examples;

  return (
    <>
      {/* The pattern itself is the big thing; that it was noticed is its label. */}
      <header className="flex flex-col gap-2">
        <PatternIcon kind="pattern" />
        <p className="text-info mt-2 text-sm font-semibold">{t("We noticed a pattern")}</p>
        <h1 className="text-3xl font-bold tracking-tight text-balance">{pattern.title}</h1>
        <p className="text-muted-foreground">
          {t(
            "{count, plural, =0 {It came up in your recent answers.} one {It came up once in your recent answers.} other {It came up # times in your recent answers.}}",
            { count: pattern.occurrences },
          )}
        </p>
      </header>

      <ExampleCard example={first} rule={pattern.rule} />
      <ContrastRows contrast={pattern.contrast} />
      <AlsoCameUp examples={others} />
    </>
  );
}

/** The kind note when the mistakes were only typos: nothing to learn, nothing to practice. */
export function TyposNote({ pattern }: { pattern: MistakePatternView }) {
  const t = useExtracted();

  return (
    <header className="flex flex-col gap-2">
      <PatternIcon kind="typos" />
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{t("Just typos")}</h1>
      <p className="text-muted-foreground">
        {t(
          "Your recent mistakes were slips while typing, not a rule you're missing. There's nothing to practice.",
        )}
      </p>
      {pattern.rule && <p className="mt-2">{pattern.rule}</p>}
    </header>
  );
}
