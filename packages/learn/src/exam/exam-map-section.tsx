"use client";

import { type ExamView } from "@zoonk/core/exams/view/contract";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { ChevronDownIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Meter, MeterFill } from "../_components/meter";
import { SectionLabel } from "../_components/section-label";
import { useFormatShare } from "../_utils/percent";
import { useExamScreen } from "./exam-context";

type Subject = NonNullable<ExamView["map"]>["subjects"][number];
type Topic = Subject["topics"][number];

/** "Appears a lot" on every row tells nothing, so it only marks rows when it sets some apart. */
function setsApart(items: readonly { frequency: Topic["frequency"] }[]): boolean {
  const frequent = items.filter((item) => item.frequency === "high").length;
  return frequent > 0 && frequent < items.length;
}

/** Whether anything from past exams shows: a tag that sets rows apart, or a topic's count. */
function showsPastExams(subjects: readonly Subject[]): boolean {
  return (
    setsApart(subjects) ||
    subjects.some(
      (subject) =>
        setsApart(subject.topics) || subject.topics.some((topic) => topic.appearances !== null),
    )
  );
}

function FrequencyChip({ frequency }: { frequency: Topic["frequency"] }) {
  const t = useExtracted();

  if (frequency !== "high") {
    return null;
  }

  return (
    <span className="bg-warning/15 text-foreground in-data-[mode=fun]:bg-fun-accent-amber/20 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap">
      {t("Appears a lot")}
    </span>
  );
}

function TopicRow({ showFrequency, topic }: { showFrequency: boolean; topic: Topic }) {
  const t = useExtracted();

  return (
    <li className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="min-w-0">{topic.name}</span>
      <LineMarker>
        {topic.appearances === null ? (
          showFrequency && <FrequencyChip frequency={topic.frequency} />
        ) : (
          <span className="text-muted-foreground tabular-nums">
            {t("{count, plural, one {# time} other {# times}}", { count: topic.appearances })}
          </span>
        )}
      </LineMarker>
    </li>
  );
}

/**
 * The learner's level in the subject: the bar fills with the same skills the line under it
 * counts, so the two always agree.
 */
function SubjectLevel({ level }: { level: Subject["level"] }) {
  const t = useExtracted();

  if (!level || level.total === 0) {
    return null;
  }

  return (
    <>
      <Meter>
        <MeterFill
          className="in-data-[mode=fun]:bg-fun-accent-violet"
          share={level.solid / level.total}
        />
      </Meter>
      <span className="text-muted-foreground text-xs">
        {t("{solid} of {total} skills solid", {
          solid: String(level.solid),
          total: String(level.total),
        })}
      </span>
    </>
  );
}

/** The subject's weight on the exam in the notice's terms: its questions, or its share. */
function useSubjectWeight() {
  const t = useExtracted();
  const formatShare = useFormatShare();

  return (subject: Subject): string => {
    const topics = t("{count, plural, one {# topic} other {# topics}}", {
      count: subject.topics.length,
    });

    if (subject.questions !== null) {
      return t("{questions, plural, one {# question} other {# questions}} · {topics}", {
        questions: subject.questions,
        topics,
      });
    }

    if (subject.share !== null) {
      return t("{share} of the exam · {topics}", { share: formatShare(subject.share), topics });
    }

    return topics;
  };
}

function SubjectRow({ showFrequency, subject }: { showFrequency: boolean; subject: Subject }) {
  const weight = useSubjectWeight();
  const showTopicFrequency = setsApart(subject.topics);

  return (
    <li className="border-border border-b py-3 last:border-b-0">
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-col gap-2 [&::-webkit-details-marker]:hidden">
          <div className="flex items-start justify-between gap-3">
            <span className="min-w-0 font-medium">{subject.name}</span>
            {/* On the name's first line, however many lines a long subject name takes. */}
            <LineMarker className="gap-2">
              {showFrequency && <FrequencyChip frequency={subject.frequency} />}
              <ChevronDownIcon
                aria-hidden="true"
                className="text-muted-foreground size-4 transition-transform group-open:rotate-180"
              />
            </LineMarker>
          </div>

          <p className="text-muted-foreground text-xs">{weight(subject)}</p>
          <SubjectLevel level={subject.level} />
        </summary>

        <ul className="mt-2 flex flex-col">
          {subject.topics.map((topic) => (
            <TopicRow key={topic.name} showFrequency={showTopicFrequency} topic={topic} />
          ))}
        </ul>
      </details>
    </li>
  );
}

/**
 * The exam map: the notice's subjects with their weight on the exam and the learner's level in
 * each, and each topic with how often the board asks it (or how many times it was on the old exam).
 */
export function ExamMapSection() {
  const t = useExtracted();
  const { exam } = useExamScreen();
  const { map } = exam;

  if (!map || map.subjects.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="exam-map-title" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <SectionLabel id="exam-map-title">{t("What's on the exam")}</SectionLabel>
        {map.hasFrequency && showsPastExams(map.subjects) && (
          <span className="text-muted-foreground text-xs">{t("From past exams")}</span>
        )}
      </div>

      <ul className="in-data-[mode=fun]:fun-glass flex flex-col in-data-[mode=fun]:rounded-3xl in-data-[mode=fun]:px-4">
        {map.subjects.map((subject) => (
          <SubjectRow
            key={subject.name}
            showFrequency={setsApart(map.subjects)}
            subject={subject}
          />
        ))}
      </ul>
    </section>
  );
}
