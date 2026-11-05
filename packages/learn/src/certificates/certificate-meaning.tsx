"use client";

import { type CertificateFacts, type CertifiedLevel } from "@zoonk/core/certificates/contract";
import { buttonVariants } from "@zoonk/ui/components/button";
import { useExtracted, useFormatter } from "next-intl";
import { DoneMark } from "../_components/status-mark";
import { LearnLink } from "../learn-link";
import { useLanguageNameInSentence } from "./certificate-labels";

/** A level is finished when every counted skill reaches the band above it. */
const BAND_ABOVE: Record<CertifiedLevel, string> = {
  A1: "A2",
  A2: "B1",
  B1: "B2",
  B2: "C1",
  C1: "C2",
};

function useMeaning(facts: CertificateFacts): string[] {
  const t = useExtracted();

  const nameNote = t(
    "The name is the one the learner gave their Zoonk account; Zoonk doesn't check IDs.",
  );

  const cefr = t(
    "Levels are aligned with the CEFR, the Common European Framework of Reference for Languages. This is not an official exam result.",
  );

  if (facts.kind === "languageLevel") {
    return [
      t(
        "Zoonk measures each skill (reading, listening, speaking, writing) from the learner's answers in lessons and practice. A level is complete when every skill those answers have raised reaches the next level, so this certificate was issued when each of them reached {level}.",
        { level: facts.level ? BAND_ABOVE[facts.level] : "" },
      ),
      `${cefr} ${nameNote}`,
    ];
  }

  return [
    facts.courseLevel
      ? t(
          "Zoonk issues this certificate when a learner finishes every chapter of a course's level, studying each lesson or passing its test, and wins every challenge in it.",
        )
      : t(
          "Zoonk issues this certificate when a learner finishes every lesson of a course's plan, by studying it or passing its test, and wins every challenge in it.",
        ),
    `${t("It's a record of completion on Zoonk, not academic credit.")} ${nameNote}`,
  ];
}

export function CertificateMeaning({ facts }: { facts: CertificateFacts }) {
  const t = useExtracted();
  const paragraphs = useMeaning(facts);

  return (
    <section aria-labelledby="certificate-meaning" className="max-w-column">
      <h2 className="text-section" id="certificate-meaning">
        {t("What this certificate means")}
      </h2>
      {paragraphs.map((paragraph) => (
        <p
          className="text-muted-foreground mt-2.5 text-[0.9375rem] leading-relaxed text-pretty"
          key={paragraph}
        >
          {paragraph}
        </p>
      ))}
    </section>
  );
}

export function CertificateCovered({ facts }: { facts: CertificateFacts }) {
  const t = useExtracted();
  const format = useFormatter();
  const items = facts.kind === "course" ? facts.topics : facts.canDo;

  if (items.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="certificate-covered" className="mt-10">
      <h2
        className="flex items-baseline gap-2 text-[0.9375rem] font-semibold"
        id="certificate-covered"
      >
        {facts.kind === "course" ? t("Topics covered") : t("Can do")}
        {facts.kind === "course" && (
          <span className="text-muted-foreground font-mono text-xs font-normal tabular-nums">
            {format.number(items.length)}
          </span>
        )}
      </h2>
      <ul className="mt-3 grid max-w-4xl gap-x-8 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li className="flex gap-2.5 text-[0.9375rem] text-pretty" key={item}>
            <DoneMark className="mt-1" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CertificateStart({ facts, href }: { facts: CertificateFacts; href: string }) {
  const t = useExtracted();
  const languageName = useLanguageNameInSentence();

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-section">
          {facts.kind === "course"
            ? t("Learn {course} on Zoonk", { course: facts.title ?? "" })
            : t("Learn {language} on Zoonk", { language: languageName(facts.targetLanguage) })}
        </h2>
        <p className="text-muted-foreground mt-1.5 text-sm">
          {t("A plan for each day that fits your time, starting from what you already know.")}
        </p>
      </div>
      <div className="flex flex-col items-start gap-1.5 sm:items-end">
        <LearnLink className={buttonVariants({ size: "lg", variant: "outline" })} href={href}>
          {t("Start this course")}
        </LearnLink>
        <span className="text-muted-foreground text-[0.8125rem]">
          {t("Start free, no account needed.")}
        </span>
      </div>
    </div>
  );
}
