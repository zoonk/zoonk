"use client";

import { type SyllabusSubject, type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { FlagIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { PageSectionFooter } from "../_components/page";
import { getSourceHost } from "../_utils/source-host";
import { usePassMarksNote } from "../_utils/use-pass-marks-note";
import { FrequencyChip, setsApart } from "./frequency-chip";
import { type SubjectGroup } from "./group-subjects";
import { type SyllabusSectionSubject, type SyllabusSectionView } from "./syllabus-section-view";

export function useGroupName({
  document,
  fromMaterial,
  group,
}: {
  document: SyllabusView["examDocument"];
  fromMaterial: boolean;
  group: SubjectGroup<SyllabusSectionSubject>;
}): string | null {
  const t = useExtracted();

  if (!group.extra) {
    return group.name;
  }

  return fromMaterial
    ? t("Also in your plan")
    : t("{document, select, notice {Beyond the notice} other {Beyond the official guide}}", {
        document,
      });
}

export function QuestionsSourceNote({
  lead,
  source,
}: {
  lead?: string;
  source: SyllabusView["questionsSource"];
}) {
  const t = useExtracted();

  if (!source) {
    return lead ? <PageSectionFooter>{lead}</PageSectionFooter> : null;
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
      {lead && `${lead} · `}
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

function frequencyTag() {
  return <FrequencyChip className="mx-0.5" frequency="high" />;
}

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
