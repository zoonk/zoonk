"use client";

import { type SyllabusSubject, type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { FlagIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { PageSectionFooter } from "../_components/page";
import { getSourceHost } from "../_utils/source-host";
import { FrequencyChip, setsApart } from "./frequency-chip";
import { type SubjectGroup } from "./group-subjects";

/**
 * A group's heading: the notice's own ("Conhecimentos básicos (P1)"), "Beyond the notice" for the
 * areas the plan adds outside it, or "Also in your plan" when the subjects come from the learner's
 * own material rather than a notice.
 */
export function useGroupName({
  fromMaterial,
  group,
}: {
  fromMaterial: boolean;
  group: SubjectGroup;
}): string | null {
  const t = useExtracted();

  if (!group.extra) {
    return group.name;
  }

  return fromMaterial ? t("Also in your plan") : t("Beyond the notice");
}

/**
 * Where the subjects' question counts come from when the notice gives none: "Questions per subject
 * in the 45º Exame, as counted by example.com", linked to the page.
 */
export function QuestionsSourceNote({ source }: { source: SyllabusView["questionsSource"] }) {
  const t = useExtracted();

  if (!source) {
    return null;
  }

  const publisher = getSourceHost(source.url);

  const link = (chunks: React.ReactNode) => (
    <a
      className="hover:text-foreground underline underline-offset-2"
      href={source.url}
      rel="noreferrer"
      target="_blank"
    >
      {chunks}
    </a>
  );

  return (
    <PageSectionFooter>
      {source.edition
        ? t.rich(
            "Questions per subject in the {edition}, as counted by <link>{publisher}</link>.",
            { edition: source.edition, link, publisher },
          )
        : t.rich(
            "Questions per subject in the latest exam, as counted by <link>{publisher}</link>.",
            { link, publisher },
          )}
    </PageSectionFooter>
  );
}

/** "Appears a lot" inside a sentence, exactly as the rows show it. */
function frequencyTag() {
  return <FrequencyChip className="mx-0.5" frequency="high" />;
}

/**
 * Where the subject's topic frequency comes from, under its topics: "Appears a lot" marks the
 * topics past exams asked most, when it sets some apart, and the plan gives them more of the
 * learner's time; when time is short the ones asked least wait. The source is cited when a lookup
 * found it; a reading of the exam's past papers has none to cite. In the learner's own material,
 * it marks the topics their notes stressed ("CAI MUITO!!").
 */
export function TopicFrequencyNote({
  fromMaterial,
  subject,
}: {
  fromMaterial: boolean;
  subject: SyllabusSubject;
}) {
  const t = useExtracted();
  const source = subject.topicFrequencySource;
  const tagged = setsApart(subject.topics);

  if (fromMaterial) {
    return tagged ? (
      <PageSectionFooter>
        {t.rich(
          "Topics marked <tag></tag> are the ones your material says come up a lot. They get more of your time.",
          { tag: frequencyTag },
        )}
      </PageSectionFooter>
    ) : null;
  }

  if (!source) {
    return tagged ? (
      <PageSectionFooter>
        {t.rich("Topics marked <tag></tag> are the ones past exams asked most.", {
          tag: frequencyTag,
        })}
      </PageSectionFooter>
    ) : null;
  }

  const link = (chunks: React.ReactNode) => (
    <a
      className="hover:text-foreground underline underline-offset-2"
      href={source.url}
      rel="noreferrer"
      target="_blank"
    >
      {chunks}
    </a>
  );

  const values = { basis: source.basis, link, publisher: getSourceHost(source.url) };
  const waits = subject.topics.some((topic) => topic.notPlannedReason === "time");

  if (tagged) {
    return (
      <PageSectionFooter>
        {waits
          ? t.rich(
              "Topics marked <tag></tag> are the ones past exams asked most ({basis}, according to <link>{publisher}</link>). The ones asked least are the ones that wait.",
              { ...values, tag: frequencyTag },
            )
          : t.rich(
              "Topics marked <tag></tag> are the ones past exams asked most ({basis}, according to <link>{publisher}</link>). They get more of your time.",
              { ...values, tag: frequencyTag },
            )}
      </PageSectionFooter>
    );
  }

  return (
    <PageSectionFooter>
      {waits
        ? t.rich(
            "The topics past exams asked least are the ones that wait ({basis}, according to <link>{publisher}</link>).",
            values,
          )
        : t.rich(
            "The topics past exams asked most get more of your time ({basis}, according to <link>{publisher}</link>).",
            values,
          )}
    </PageSectionFooter>
  );
}

/** A source's site, not its page title: page titles run long ("Termo de Adesão da UFMG ao SiSU…"). */
/** The parts of the exam the learner's course weighs more than the others, by their short names. */
function getHeavierParts({
  subjects,
  weights,
}: {
  subjects: SyllabusView["subjects"];
  weights: NonNullable<SyllabusView["courseWeights"]>;
}): string[] {
  const lightest = Math.min(...weights.subjects.map((subject) => subject.weight));

  return weights.subjects
    .filter((subject) => subject.weight > lightest)
    .map((part) => subjects.find((subject) => subject.name === part.name)?.shortName ?? part.name);
}

/**
 * How the learner's course weighs the exam's parts at their institution, under the card, with
 * where the weights come from: "Medicina at UFMG counts Natureza and Redação more, so your plan
 * gives them more of your time. Weights from ufmg.br."
 */
export function CourseWeightsNote({
  subjects,
  weights,
}: {
  subjects: SyllabusView["subjects"];
  weights: SyllabusView["courseWeights"];
}) {
  const t = useExtracted();
  const format = useFormatter();

  if (!weights?.source) {
    return null;
  }

  const { url } = weights.source;
  const heavier = getHeavierParts({ subjects, weights });

  const link = (chunks: React.ReactNode) => (
    <a
      className="hover:text-foreground underline underline-offset-2"
      href={url}
      rel="noreferrer"
      target="_blank"
    >
      {chunks}
    </a>
  );

  const values = {
    course: weights.course,
    institution: weights.institution,
    link,
    publisher: getSourceHost(url),
  };

  return (
    <PageSectionFooter>
      {heavier.length > 0
        ? t.rich(
            "{course} at {institution} counts {parts} more, so your plan gives them more of your time. Weights from <link>{publisher}</link>.",
            { ...values, parts: format.list(heavier, { type: "conjunction" }) },
          )
        : t.rich(
            "{course} at {institution} counts every part of the exam the same. Weights from <link>{publisher}</link>.",
            values,
          )}
    </PageSectionFooter>
  );
}

/** What it takes to pass, as the notice says it, under the card: said once, where the plan starts. */
export function PassMarks({ passMarks }: { passMarks: readonly string[] }) {
  if (passMarks.length === 0) {
    return null;
  }

  return (
    <ul className="text-muted-foreground flex flex-col gap-1 px-1 text-sm">
      {passMarks.map((passMark) => (
        <li className="flex items-start gap-2" key={passMark}>
          <FlagIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{passMark}</span>
        </li>
      ))}
    </ul>
  );
}
