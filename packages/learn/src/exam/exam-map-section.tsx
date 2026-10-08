"use client";

import { type ExamView } from "@zoonk/core/exams/view/contract";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  LIST_GROUP_CLASS,
  LIST_ROW_INTERACTIVE_CLASS,
  ListRowContent,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import {
  PageSection,
  PageSectionHeader,
  PageSectionLabel,
  PageSectionTitle,
} from "../_components/page";
import { useFormatShare } from "../_utils/percent";
import { FrequencyChip, setsApart } from "../syllabus/frequency-chip";
import { groupSubjects } from "../syllabus/group-subjects";
import { QuestionsSourceNote } from "../syllabus/syllabus-notes";
import { useExamScreen } from "./exam-context";

type Subject = NonNullable<ExamView["map"]>["subjects"][number];
type Topic = Subject["topics"][number];

/** Whether a subject's topics show anything from past exams: a tag or a count. */
function showsPastExams(topics: readonly Topic[]): boolean {
  return setsApart(topics) || topics.some((topic) => topic.appearances !== null);
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

/** The subject's weight on the exam in the notice's terms: its questions, or its share. */
function useSubjectWeight() {
  const t = useExtracted();
  const formatShare = useFormatShare();

  return (subject: Subject): string => {
    if (subject.questions !== null) {
      return t("{count, plural, one {# question} other {# questions}}", {
        count: subject.questions,
      });
    }

    if (subject.share !== null) {
      return t("{share} of the exam", { share: formatShare(subject.share) });
    }

    return "";
  };
}

/** A subject in one line, its weight on the right; its topics open in place. */
function SubjectRow({
  hasFrequency,
  showFrequency,
  subject,
}: {
  hasFrequency: boolean;
  showFrequency: boolean;
  subject: Subject;
}) {
  const t = useExtracted();
  const weight = useSubjectWeight();
  const showTopicFrequency = setsApart(subject.topics);
  const subjectWeight = weight(subject);

  return (
    <li>
      <details className="group">
        <summary
          className={cn(
            LIST_ROW_INTERACTIVE_CLASS,
            "cursor-pointer list-none [&::-webkit-details-marker]:hidden",
          )}
        >
          <ListRowContent>
            <ListRowTitle>{subject.name}</ListRowTitle>
          </ListRowContent>
          <ListRowTrailing>
            {showFrequency && <FrequencyChip frequency={subject.frequency} />}
            {subjectWeight && <span className="whitespace-nowrap">{subjectWeight}</span>}
          </ListRowTrailing>
          <ChevronDownIcon
            aria-hidden="true"
            className="text-muted-foreground/60 size-4 shrink-0 self-center transition-transform group-open:rotate-180 motion-reduce:transition-none"
          />
        </summary>

        <div className="flex flex-col gap-1 px-4 pb-3">
          <ul className="flex flex-col">
            {subject.topics.map((topic) => (
              <TopicRow key={topic.name} showFrequency={showTopicFrequency} topic={topic} />
            ))}
          </ul>

          {hasFrequency && showsPastExams(subject.topics) && (
            <p className="text-muted-foreground text-xs">{t("From past exams")}</p>
          )}
        </div>
      </details>
    </li>
  );
}

const getGroupId = (index: number) => `exam-map-group-${index}`;

/**
 * What's on the exam, as a short list: each of the notice's subjects with its weight, in the
 * notice's groups ("Conhecimentos básicos (P1)") when it has them, and its topics one tap away with
 * how often the board asks them. How ready the learner is in each lives on the Journey.
 */
export function ExamMapSection() {
  const t = useExtracted();
  const { exam } = useExamScreen();
  const { map } = exam;

  if (!map || map.subjects.length === 0) {
    return null;
  }

  return (
    <PageSection aria-labelledby="exam-map-title">
      <PageSectionHeader>
        <PageSectionTitle id="exam-map-title">{t("What's on the exam")}</PageSectionTitle>
      </PageSectionHeader>

      {groupSubjects(map.subjects, { modules: false }).map((group, index) => (
        <div className="flex flex-col gap-2" key={group.name ?? "all"}>
          {group.name && <PageSectionLabel id={getGroupId(index)}>{group.name}</PageSectionLabel>}

          <ul
            aria-labelledby={group.name ? getGroupId(index) : "exam-map-title"}
            className={LIST_GROUP_CLASS}
          >
            {group.subjects.map((subject) => (
              <SubjectRow
                hasFrequency={map.hasFrequency}
                key={subject.name}
                showFrequency={setsApart(map.subjects)}
                subject={subject}
              />
            ))}
          </ul>
        </div>
      ))}

      <QuestionsSourceNote source={map.questionsSource} />
    </PageSection>
  );
}
