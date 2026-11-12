"use client";

import { type SyllabusSubject, type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { FlagIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { PageSectionFooter } from "../_components/page";
import { QuietDisclosure } from "../_components/quiet-disclosure";
import { getSourceHost } from "../_utils/source-host";
import { usePassMarksNote } from "../_utils/use-pass-marks-note";
import { type SubjectGroup } from "./group-subjects";
import { type SyllabusSectionSubject, type SyllabusSectionView } from "./syllabus-section-view";

export function useGroupName(group: SubjectGroup<SyllabusSectionSubject>): string | null {
  const t = useExtracted();
  return group.extra ? t("Also in your plan") : group.name;
}

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

/** Where the "Asked a lot" marks come from, for the learner who wants to check. */
export function TopicFrequencySource({
  source,
}: {
  source: SyllabusSubject["topicFrequencySource"];
}) {
  const t = useExtracted();

  if (!source) {
    return null;
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

  return (
    <QuietDisclosure label={t("Sources")}>
      <PageSectionFooter className="pt-2">
        {t.rich(
          "How often past exams asked each topic: {basis}, according to <link>{publisher}</link>.",
          { basis: source.basis, link, publisher: getSourceHost(source.url) },
        )}
      </PageSectionFooter>
    </QuietDisclosure>
  );
}

function getHeavierParts({
  subjects,
  weights,
}: {
  subjects: SyllabusSectionView["subjects"];
  weights: NonNullable<SyllabusView["courseWeights"]>;
}): string[] {
  const lightest = Math.min(...weights.subjects.map((subject) => subject.weight));

  return weights.subjects
    .filter((subject) => subject.weight > lightest)
    .map((part) => subjects.find((subject) => subject.name === part.name)?.shortName ?? part.name);
}

export function CourseWeightsNote({
  subjects,
  weights,
}: {
  subjects: SyllabusSectionView["subjects"];
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

export function PassMarks({ passMarks }: { passMarks: SyllabusView["passMarks"] }) {
  const note = usePassMarksNote(passMarks);

  if (!passMarks) {
    return null;
  }

  return (
    <ul className="text-muted-foreground flex flex-col gap-1 px-1 text-sm">
      {passMarks.texts.map((text) => (
        <li className="flex items-start gap-2" key={text}>
          <FlagIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span lang={passMarks.language}>{text}</span>
        </li>
      ))}
      {note && <li className="pl-6">{note}</li>}
    </ul>
  );
}
