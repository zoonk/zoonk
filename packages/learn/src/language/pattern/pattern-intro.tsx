"use client";

import { type MistakePatternView } from "@zoonk/core/language/patterns/contract";
import { MicIcon, PenLineIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { DiffLines } from "../../_components/diff-lines";
import { LIST_GROUP_CLASS } from "../../_components/list-group";
import { PageEyebrow, PageSectionTitle, PageTitle } from "../../_components/page";

type PatternExample = MistakePatternView["examples"][number];

function ContrastLabel({ label }: { label: string }) {
  const [head, ...rest] = label.split(" + ");

  return (
    <span className="min-w-0 flex-1">
      <span className="font-semibold">{head}</span>
      {rest.length > 0 && <span className="text-muted-foreground">{` + ${rest.join(" + ")}`}</span>}
    </span>
  );
}

function RuleExample({ example, rule }: { example: PatternExample | undefined; rule: string }) {
  const t = useExtracted();

  return (
    <section aria-label={t("The rule")} className="flex flex-col gap-3">
      {example && (
        <DiffLines
          labels={{ added: t("Correct version"), removed: t("You said") }}
          lines={[
            { kind: "removed", text: example.answer },
            { kind: "added", text: example.correctAnswer },
          ]}
        />
      )}
      <p className="text-[0.9375rem] leading-relaxed text-pretty">{rule}</p>
    </section>
  );
}

function ContrastRows({ contrast }: { contrast: MistakePatternView["contrast"] }) {
  if (contrast.length === 0) {
    return null;
  }

  return (
    <ul className={LIST_GROUP_CLASS}>
      {contrast.map((row) => (
        <li className="flex items-baseline gap-3 py-2.5 text-sm" key={row.label}>
          <ContrastLabel label={row.label} />
          <span className="text-muted-foreground shrink-0 text-end">{row.example}</span>
        </li>
      ))}
    </ul>
  );
}

export function PatternRule({ pattern }: { pattern: MistakePatternView }) {
  return (
    <div className="flex flex-col gap-3">
      <ContrastRows contrast={pattern.contrast} />
      <p className="text-[0.8125rem] leading-relaxed text-pretty">{pattern.rule}</p>
    </div>
  );
}

export function PatternSlip({ pattern }: { pattern: MistakePatternView }) {
  const t = useExtracted();
  const titleId = useId();
  const [example] = pattern.examples;

  if (!example) {
    return null;
  }

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2">
      <PageSectionTitle id={titleId}>{t("Where you slipped")}</PageSectionTitle>
      <DiffLines
        labels={{ added: t("Correct version"), removed: t("You said") }}
        lines={[
          { kind: "removed", text: example.answer },
          { kind: "added", text: example.correctAnswer },
        ]}
      />
    </section>
  );
}

function AlsoCameUp({ examples }: { examples: PatternExample[] }) {
  const t = useExtracted();

  if (examples.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="pattern-also" className="flex flex-col gap-2">
      <PageSectionTitle id="pattern-also">{t("Also came up in")}</PageSectionTitle>
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

export function PatternIntro({ pattern }: { pattern: MistakePatternView }) {
  const t = useExtracted();
  const [first, ...others] = pattern.examples;

  return (
    <>
      <header className="flex flex-col gap-2">
        <PageEyebrow>{t("We noticed a pattern")}</PageEyebrow>
        <PageTitle className="text-balance">{pattern.title}</PageTitle>
        <p className="text-muted-foreground text-pretty">
          {t(
            "{count, plural, =0 {It came up in your recent answers.} one {It came up once in your recent answers.} other {It came up # times in your recent answers.}}",
            { count: pattern.occurrences },
          )}
        </p>
      </header>

      <RuleExample example={first} rule={pattern.rule} />
      <ContrastRows contrast={pattern.contrast} />
      <AlsoCameUp examples={others} />
    </>
  );
}

export function TyposNote({ pattern }: { pattern: MistakePatternView }) {
  const t = useExtracted();

  return (
    <header className="flex flex-col gap-2">
      <PageEyebrow>{t("Mistake pattern")}</PageEyebrow>
      <PageTitle>{t("Just typos")}</PageTitle>
      <p className="text-muted-foreground text-pretty">
        {t(
          "Your recent mistakes were slips while typing, not a rule you're missing. There's nothing to practice.",
        )}
      </p>
      {pattern.rule && <p className="mt-2 text-pretty">{pattern.rule}</p>}
    </header>
  );
}
