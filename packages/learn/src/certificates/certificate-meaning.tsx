"use client";

import { type CertificateFacts } from "@zoonk/core/certificates/contract";
import { buttonVariants } from "@zoonk/ui/components/button";
import { useExtracted, useFormatter } from "next-intl";
import { DoneMark } from "../_components/status-mark";
import { LearnLink } from "../learn-link";

/** A free learner finishes a language level without its Plus calls, so it claims no challenge. */
function useMeaning(facts: CertificateFacts): string[] {
  const t = useExtracted();

  const nameNote = t(
    "The name is the one the learner gave their Zoonk account; Zoonk doesn't check IDs.",
  );

  if (facts.cefrRange) {
    return [
      t(
        "Zoonk issues this certificate when a learner finishes every lesson of a language course's level, studying at least half of them on Zoonk and passing any others by test.",
      ),
      `${t(
        "Levels are aligned with the CEFR, the Common European Framework of Reference for Languages. This is not an official exam result.",
      )} ${nameNote}`,
    ];
  }

  return [
    facts.courseLevel
      ? t(
          "Zoonk issues this certificate when a learner finishes every lesson of a course's level, studying at least half of them on Zoonk and passing any others by test, and wins every challenge in it.",
        )
      : t(
          "Zoonk issues this certificate when a learner finishes every lesson of a course's plan, studying at least half of them on Zoonk and passing any others by test, and wins every challenge in it.",
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

  if (facts.topics.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="certificate-covered" className="mt-10">
      <h2
        className="flex items-baseline gap-2 text-[0.9375rem] font-semibold"
        id="certificate-covered"
      >
        {t("Topics covered")}
        <span className="text-muted-foreground font-mono text-xs font-normal tabular-nums">
          {format.number(facts.topics.length)}
        </span>
      </h2>
      <ul className="mt-3 grid max-w-4xl gap-x-8 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {facts.topics.map((item) => (
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

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-section">{t("Learn {course} on Zoonk", { course: facts.title })}</h2>
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
